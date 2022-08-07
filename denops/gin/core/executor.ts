import type { Denops } from "https://deno.land/x/denops_std@v3.8.1/mod.ts";
import { writeAll } from "https://deno.land/std@0.151.0/streams/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.8.1/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.8.1/function/mod.ts";
import * as option from "https://deno.land/x/denops_std@v3.8.1/option/mod.ts";
import { decodeUtf8 } from "../util/text.ts";
import { expand } from "../util/cmd.ts";
import { removeAnsiEscapeCode } from "../util/ansi_escape_code.ts";
import {
  findWorktreeFromSuspects,
  listWorktreeSuspectsFromDenops,
} from "../util/worktree.ts";
import { run } from "../git/process.ts";

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
  postProcessor?: string[];
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
  const [env, verbose] = await batch.gather(
    denops,
    async (denops) => {
      await fn.environ(denops);
      await option.verbose.get(denops);
    },
  ) as [Record<string, string>, number];

  const worktree = await findWorktreeFromSuspects(
    options.worktree
      ? [await expand(denops, options.worktree)]
      : await listWorktreeSuspectsFromDenops(denops, !!verbose),
    !!verbose,
  );

  const proc = run(args, {
    printCommand: !!verbose,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    noOptionalLocks: true,
    cwd: worktree,
    env,
  });

  const [status, stdout, stderr] = await Promise.all([
    proc.status(),
    proc.output(),
    proc.stderrOutput(),
  ]);
  proc.close();

  // Early return when execution has failed
  if (!status.success) {
    if (options.throwOnError) {
      throw new ExecuteError(removeAnsiEscapeCode(decodeUtf8(stderr)));
    }
    return { success: status.success, stdout, stderr };
  }

  // Return when no post-processor is specified
  const postProcessor = options.postProcessor ?? [];
  if (!postProcessor.length) {
    return { success: status.success, stdout, stderr };
  }

  // Run post-processor
  const procPost = Deno.run({
    cmd: postProcessor,
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
    cwd: worktree,
    env,
  });
  await writeAll(procPost.stdin, stdout);
  procPost.stdin.close();
  const [statusPost, stdoutPost, stderrPost] = await Promise.all([
    procPost.status(),
    procPost.output(),
    procPost.stderrOutput(),
  ]);
  procPost.close();

  if (options.throwOnError && !statusPost.success) {
    throw new ExecuteError(removeAnsiEscapeCode(decodeUtf8(stderrPost)));
  }

  return {
    success: statusPost.success,
    stdout: stdoutPost,
    stderr: stderrPost,
  };
}
