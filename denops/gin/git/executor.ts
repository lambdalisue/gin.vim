import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { readAll } from "https://deno.land/x/streamtools@v0.5.0/read_all.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import { decodeUtf8 } from "../util/text.ts";
import { removeAnsiEscapeCode } from "../util/ansi_escape_code.ts";
import { IndicatorStream } from "../util/indicator_stream.ts";
import { findWorktreeFromDenops } from "./worktree.ts";
import { run } from "./process.ts";

export class ExecuteError extends Error {
  constructor(message?: string) {
    super(message);

    Object.defineProperty(this, "name", {
      configurable: true,
      enumerable: false,
      value: this.constructor.name,
      writable: true,
    });

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ExecuteError);
    }
  }
}

export type ExecuteOptions = {
  worktree?: string;
  throwOnError?: boolean;
  processor?: string[];
  stdoutIndicator?: string;
  stderrIndicator?: string;
};

export type ExecuteResult = {
  success: boolean;
  stdout: Uint8Array;
  stderr: Uint8Array;
};

export async function execute(
  denops: Denops,
  args: string[],
  options: ExecuteOptions = {},
): Promise<ExecuteResult> {
  const [env, verbose] = await batch.collect(
    denops,
    (denops) => [
      fn.environ(denops) as Promise<Record<string, string>>,
      option.verbose.get(denops),
    ],
  );

  const worktree = await findWorktreeFromDenops(denops, {
    worktree: options.worktree,
    verbose: !!verbose,
  });

  const proc = run(args, {
    printCommand: !!verbose,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    noOptionalLocks: true,
    cwd: worktree,
    env,
  });

  const stdoutIndicator = options.stdoutIndicator ?? "echo";
  const stderrIndicator = options.stderrIndicator ?? "echo";
  const [success, stdout, stderr] = await Promise.all([
    proc.status.then((status) => status.success),
    readAll(proc.stdout.pipeThrough(
      buildIndicatorStream(denops, stdoutIndicator),
    )),
    readAll(proc.stderr.pipeThrough(
      buildIndicatorStream(denops, stderrIndicator),
    )),
  ]);

  // Early return when execution has failed
  if (!success) {
    if (options.throwOnError) {
      throw new ExecuteError(removeAnsiEscapeCode(decodeUtf8(stderr)));
    }
    return { success, stdout, stderr };
  }

  // Return when no post-processor is specified
  const processor = options.processor ?? [];
  if (!processor.length) {
    return { success, stdout, stderr };
  }

  // Run post-processor
  const postResult = await postProcessor(processor, worktree, stdout, env);

  if (options.throwOnError && !postResult.success) {
    throw new ExecuteError(removeAnsiEscapeCode(decodeUtf8(postResult.stderr)));
  }

  return {
    success: postResult.success,
    stdout: postResult.stdout,
    stderr: postResult.stderr,
  };
}

async function postProcessor(
  processor: string[],
  worktree: string,
  stdout: Uint8Array,
  env: Deno.CommandOptions["env"],
) {
  const [cmd, ...args] = processor;
  const command = new Deno.Command(cmd, {
    args,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
    cwd: worktree,
    env,
  });
  const proc = command.spawn();
  const reader = new Blob([stdout]);
  const [_, result] = await Promise.all([
    reader.stream().pipeTo(proc.stdin),
    proc.output(),
  ]);
  return result;
}

function buildIndicatorStream(
  denops: Denops,
  name: string,
): IndicatorStream {
  if (name === "null") {
    return new IndicatorStream({
      async open() {},
      async write() {},
      async close() {},
    });
  }
  const indicator = {
    async open(id: string) {
      await denops.call(
        `gin#indicator#${name}#open`,
        id,
      );
    },
    async write(id: string, content: string[]) {
      await denops.call(
        `gin#indicator#${name}#write`,
        id,
        content,
      );
    },
    async close(id: string) {
      await denops.call(
        `gin#indicator#${name}#close`,
        id,
      );
    },
  };
  return new IndicatorStream(indicator);
}
