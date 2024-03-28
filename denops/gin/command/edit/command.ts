import type { Denops } from "https://deno.land/x/denops_std@v6.0.1/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.0.1/buffer/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.0.1/option/mod.ts";
import {
  format as formatBufname,
} from "https://deno.land/x/denops_std@v6.0.1/bufname/mod.ts";
import { findWorktreeFromDenops } from "../../git/worktree.ts";

export type ExecOptions = {
  worktree?: string;
  commitish?: string;
  opener?: string;
  cmdarg?: string;
  mods?: string;
  bang?: boolean;
};

export async function exec(
  denops: Denops,
  filename: string,
  options: ExecOptions = {},
): Promise<buffer.OpenResult> {
  const verbose = await option.verbose.get(denops);

  const worktree = await findWorktreeFromDenops(denops, {
    worktree: options.worktree,
    verbose: !!verbose,
  });

  const relpath = path.isAbsolute(filename)
    ? path.relative(worktree, filename)
    : filename;

  const bufname = formatBufname({
    scheme: "ginedit",
    expr: worktree,
    params: {
      commitish: options.commitish,
    },
    fragment: relpath,
  });
  return await buffer.open(denops, bufname.toString(), {
    opener: options.opener,
    cmdarg: options.cmdarg,
    mods: options.mods,
    bang: options.bang,
  });
}
