import type { Denops } from "https://deno.land/x/denops_std@v3.3.0/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.3.0/autocmd/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.3.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.3.0/function/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v3.3.0/helper/mod.ts";
import * as option from "https://deno.land/x/denops_std@v3.3.0/option/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import {
  parseOpts,
  validateOpts,
} from "https://deno.land/x/denops_std@v3.3.0/argument/mod.ts";
import { expand, normCmdArgs } from "../../util/cmd.ts";
import * as buffer from "https://deno.land/x/denops_std@v3.3.0/buffer/mod.ts";
import {
  buildDecorationsFromAnsiEscapeCode,
  removeAnsiEscapeCode,
} from "../../util/ansi_escape_code.ts";
import {
  findWorktreeFromSuspects,
  listWorktreeSuspectsFromDenops,
} from "../../util/worktree.ts";
import { decodeUtf8 } from "../../util/text.ts";
import { run } from "../../git/process.ts";

export type Options = {
  worktree?: string;
  buffer?: boolean | string;
  monochrome?: boolean;
  fileformat?: string;
  encoding?: string;
};

export async function command(
  denops: Denops,
  args: string[],
): Promise<void> {
  const [opts, residue] = parseOpts(await normCmdArgs(denops, args));
  validateOpts(opts, [
    "worktree",
    "buffer",
    "monochrome",
    "ff",
    "fileformat",
    "enc",
    "encoding",
  ]);
  const buffer = opts["buffer"] === "" ? true : opts["buffer"];
  const options = {
    worktree: opts["worktree"],
    buffer,
    monochrome: "monochrome" in opts,
    fileformat: opts["ff"] ?? opts["fileformat"],
    encoding: opts["enc"] ?? opts["encoding"],
  };
  await exec(denops, residue, options);
}

export async function exec(
  denops: Denops,
  args: string[],
  options: Options = {},
): Promise<void> {
  const [verbose, env, eventignore] = await batch.gather(
    denops,
    async (denops) => {
      await option.verbose.get(denops);
      await fn.environ(denops);
      await option.eventignore.get(denops);
    },
  );
  unknownutil.assertNumber(verbose);
  unknownutil.assertObject(env, unknownutil.isString);
  unknownutil.assertString(eventignore);

  const enableColor = options.buffer && !options.monochrome;
  const cmd = [
    ...(enableColor ? ["-c", "color.ui=always"] : []),
    ...args,
  ];
  const worktree = await findWorktreeFromSuspects(
    options.worktree
      ? [await expand(denops, options.worktree)]
      : await listWorktreeSuspectsFromDenops(denops, !!verbose),
    !!verbose,
  );
  const proc = run(cmd, {
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
  if (options.buffer) {
    let decorations: buffer.Decoration[] = [];
    const preprocessor = (content: string[]) => {
      const [trimmed, decos] = buildDecorationsFromAnsiEscapeCode(content);
      decorations = decos;
      return trimmed;
    };
    let bufnr: number;
    if (typeof options.buffer === "string") {
      bufnr = await fn.bufnr(denops, options.buffer);
      if (bufnr === -1) {
        bufnr = await fn.bufnr(denops, Number(options.buffer));
      }
      await fn.bufload(denops, bufnr);
    } else {
      await denops.cmd("noswapfile enew");
      bufnr = await fn.bufnr(denops);
    }
    await batch.batch(denops, async (denops) => {
      await fn.setbufvar(denops, bufnr, "&modifiable", 0);
    });
    await buffer.assign(
      denops,
      bufnr,
      new Uint8Array([...stdout, ...stderr]),
      {
        fileformat: options.fileformat,
        fileencoding: options.encoding,
        preprocessor,
      },
    );
    await buffer.decorate(denops, bufnr, decorations);
    await buffer.concrete(denops, bufnr);
    if (denops.meta.host === "vim") {
      await denops.cmd("redraw");
    }
  } else {
    if (status.success) {
      await helper.echo(
        denops,
        removeAnsiEscapeCode(decodeUtf8(stdout) + decodeUtf8(stderr)),
      );
    } else {
      await helper.echoerr(
        denops,
        removeAnsiEscapeCode(decodeUtf8(stdout) + decodeUtf8(stderr)),
      );
    }
  }
  if (status.success && !eventignore.includes("all")) {
    await autocmd.emit(denops, "User", "GinCommandPost", {
      nomodeline: true,
    });
  }
}

export async function bind(denops: Denops, bufnr: number): Promise<void> {
  await autocmd.group(denops, `gin_bare_command_bind_${bufnr}`, (helper) => {
    helper.remove();
    helper.define(
      "User",
      "GinCommandPost",
      `call gin#util#reload(${bufnr})`,
    );
  });
}
