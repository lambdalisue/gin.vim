import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import * as fs from "https://deno.land/std@0.221.0/fs/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import {
  parse as parseBufname,
} from "https://deno.land/x/denops_std@v6.4.0/bufname/mod.ts";
import { findWorktreeFromDenops } from "../../git/worktree.ts";
import { exec as execBare } from "../../command/bare/command.ts";

export async function write(
  denops: Denops,
  bufnr: number,
  bufname: string,
): Promise<void> {
  const { scheme, expr, fragment } = parseBufname(bufname);
  if (!fragment) {
    throw new Error(`A buffer '${scheme}://' requires a fragment part`);
  }
  await exec(denops, bufnr, fragment, {
    worktree: expr,
  });
}

export type ExecOptions = {
  worktree?: string;
};

export async function exec(
  denops: Denops,
  bufnr: number,
  relpath: string,
  options: ExecOptions,
): Promise<void> {
  const [verbose, fileencoding, fileformat, content] = await batch.collect(
    denops,
    (denops) => [
      option.verbose.get(denops),
      option.fileencoding.getBuffer(denops, bufnr),
      option.fileformat.getBuffer(denops, bufnr),
      fn.getbufline(denops, bufnr, 1, "$"),
    ],
  );

  const worktree = await findWorktreeFromDenops(denops, {
    worktree: options.worktree,
    verbose: !!verbose,
  });

  const original = path.join(worktree, relpath);
  let restore: () => Promise<void>;
  const f = await Deno.makeTempFile({
    dir: path.dirname(original),
  });
  try {
    await Deno.rename(original, f);
    restore = () => Deno.rename(f, original);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
    await Deno.remove(f);
    restore = () => Deno.remove(original);
  }
  try {
    await fs.copy(f, original);
    await Deno.writeTextFile(original, `${content.join("\n")}\n`);
    await fn.setbufvar(denops, bufnr, "&modified", 0);
    await execBare(denops, [
      "add",
      "--force",
      "--",
      relpath,
    ], {
      worktree,
      encoding: fileencoding,
      fileformat,
    });
  } finally {
    await restore();
  }
}
