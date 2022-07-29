import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.5.0/autocmd/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.5.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.5.0/function/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v3.5.0/helper/mod.ts";
import * as option from "https://deno.land/x/denops_std@v3.5.0/option/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import {
  builtinOpts,
  parseOpts,
  validateOpts,
} from "https://deno.land/x/denops_std@v3.5.0/argument/mod.ts";
import { normCmdArgs } from "../../util/cmd.ts";
import * as buffer from "https://deno.land/x/denops_std@v3.5.0/buffer/mod.ts";
import {
  buildDecorationsFromAnsiEscapeCode,
  removeAnsiEscapeCode,
} from "../../util/ansi_escape_code.ts";
import { getWorktreeFromOpts } from "../../util/worktree.ts";
import { decodeUtf8 } from "../../util/text.ts";
import { run } from "../../git/process.ts";

export async function command(
  denops: Denops,
  args: string[],
): Promise<void> {
  const [env, verbose, eventignore] = await batch.gather(
    denops,
    async (denops) => {
      await fn.environ(denops);
      await option.verbose.get(denops);
      await option.eventignore.get(denops);
    },
  );
  unknownutil.assertObject(env, unknownutil.isString);
  unknownutil.assertNumber(verbose);
  unknownutil.assertString(eventignore);
  const [opts, residue] = parseOpts(await normCmdArgs(denops, args));
  validateOpts(opts, [
    "worktree",
    "buffer",
    "monochrome",
    ...builtinOpts,
  ]);
  const enableColor = "buffer" in opts && !("monochrome" in opts);
  const cmd = [
    ...(enableColor ? ["-c", "color.ui=always"] : []),
    ...residue,
  ];
  const worktree = await getWorktreeFromOpts(denops, opts);
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
  if ("buffer" in opts) {
    let decorations: buffer.Decoration[] = [];
    const preprocessor = (content: string[]) => {
      const [trimmed, decos] = buildDecorationsFromAnsiEscapeCode(content);
      decorations = decos;
      return trimmed;
    };
    await denops.cmd("noswapfile enew");
    const bufnr = await fn.bufnr(denops);
    await buffer.ensure(denops, bufnr, async () => {
      await batch.batch(denops, async (denops) => {
        await option.modifiable.setLocal(denops, false);
      });
    });
    await buffer.assign(
      denops,
      bufnr,
      new Uint8Array([...stdout, ...stderr]),
      {
        fileformat: (opts["ff"] ?? opts["fileformat"]),
        fileencoding: opts["enc"] ?? opts["fileencoding"],
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
