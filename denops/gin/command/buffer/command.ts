import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { unnullish } from "https://deno.land/x/unnullish@v1.0.1/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import {
  format as formatBufname,
} from "https://deno.land/x/denops_std@v6.4.0/bufname/mod.ts";
import { findWorktreeFromDenops } from "../../git/worktree.ts";

export type ExecOptions = {
  processor?: string[];
  worktree?: string;
  monochrome?: boolean;
  opener?: string;
  emojify?: boolean;
  cmdarg?: string;
  mods?: string;
  bang?: boolean;
};

export async function exec(
  denops: Denops,
  args: string[],
  options: ExecOptions = {},
): Promise<buffer.OpenResult> {
  const verbose = await option.verbose.get(denops);
  const worktree = await findWorktreeFromDenops(denops, {
    worktree: options.worktree,
    verbose: !!verbose,
  });
  const bufname = formatBufname({
    scheme: "gin",
    expr: worktree,
    params: {
      processor: unnullish(options.processor, (v) => v.join(" ")),
      monochrome: unnullish(options.monochrome, (v) => v ? "" : undefined),
      emojify: unnullish(options.emojify, (v) => v ? "" : undefined),
    },
    fragment: `${args.join(" ")}$`,
  });
  return await buffer.open(denops, bufname, {
    opener: options.opener,
    cmdarg: options.cmdarg,
    mods: options.mods,
    bang: options.bang,
  });
}
