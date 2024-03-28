import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import { parse as parseBufname } from "https://deno.land/x/denops_std@v6.4.0/bufname/mod.ts";
import {
  Flags,
  formatFlags,
  parseOpts,
} from "https://deno.land/x/denops_std@v6.4.0/argument/mod.ts";
import { bind } from "../../command/bare/command.ts";
import { exec as execBuffer } from "../../command/buffer/edit.ts";
import { init as initActionBranchDelete } from "../../action/branch_delete.ts";
import { init as initActionBranchMove } from "../../action/branch_move.ts";
import { init as initActionBranchNew } from "../../action/branch_new.ts";
import { init as initActionBrowse } from "../../action/browse.ts";
import { init as initActionCore, Range } from "../../action/core.ts";
import { init as initActionEcho } from "../../action/echo.ts";
import { init as initActionLog } from "../../action/log.ts";
import { init as initActionMerge } from "../../action/merge.ts";
import { init as initActionRebase } from "../../action/rebase.ts";
import { init as initActionSwitch } from "../../action/switch.ts";
import { init as initActionYank } from "../../action/yank.ts";
import { Branch, parse as parseBranch } from "./parser.ts";

export async function edit(
  denops: Denops,
  bufnr: number,
  bufname: string,
): Promise<void> {
  const cmdarg = await vars.v.get(denops, "cmdarg") as string;
  const [opts, _] = parseOpts(cmdarg.split(" "));
  const { expr, params, fragment } = parseBufname(bufname);
  await exec(denops, bufnr, {
    worktree: expr,
    flags: params,
    patterns: fragment?.replace(/\$$/, "").split(" ").filter((v) => v),
    encoding: opts.enc ?? opts.encoding,
    fileformat: opts.ff ?? opts.fileformat,
  });
}

export type ExecOptions = {
  worktree?: string;
  flags?: Flags;
  patterns?: string[];
  encoding?: string;
  fileformat?: string;
};

export async function exec(
  denops: Denops,
  bufnr: number,
  options: ExecOptions,
): Promise<void> {
  const args = [
    "branch",
    "--list",
    "-vv",
    ...formatFlags(options.flags ?? {}),
    "--",
    ...(options.patterns ?? []),
  ];
  await execBuffer(denops, bufnr, args, {
    worktree: options.worktree,
    encoding: options.encoding,
    fileformat: options.fileformat,
  });
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await bind(denops, bufnr);
      await initActionCore(denops, bufnr);
      await initActionBranchDelete(denops, bufnr, gatherCandidates);
      await initActionBranchMove(denops, bufnr, gatherCandidates);
      await initActionBranchNew(denops, bufnr, gatherCandidates);
      await initActionBrowse(denops, bufnr, async (denops, bufnr, range) => {
        const xs = await gatherCandidates(denops, bufnr, range);
        return xs.map((b) => ({ commit: b.target, ...b }));
      });
      await initActionEcho(denops, bufnr, gatherCandidates);
      await initActionLog(denops, bufnr, async (denops, bufnr, range) => {
        const xs = await gatherCandidates(denops, bufnr, range);
        return xs.map((b) => ({ commitish: b.target, ...b }));
      });
      await initActionMerge(denops, bufnr, async (denops, bufnr, range) => {
        const xs = await gatherCandidates(denops, bufnr, range);
        return xs.map((b) => ({ commit: b.target, ...b }));
      });
      await initActionRebase(denops, bufnr, async (denops, bufnr, range) => {
        const xs = await gatherCandidates(denops, bufnr, range);
        return xs.map((b) => ({ commit: b.target, ...b }));
      });
      await initActionSwitch(denops, bufnr, async (denops, bufnr, range) => {
        const xs = await gatherCandidates(denops, bufnr, range);
        return xs.map((b) => ({ target: b.branch }));
      });
      await initActionYank(denops, bufnr, async (denops, bufnr, range) => {
        const xs = await gatherCandidates(denops, bufnr, range);
        return xs.map((b) => ({ value: b.branch }));
      }, {
        suffix: ":branch",
      });
      await initActionYank(denops, bufnr, async (denops, bufnr, range) => {
        const xs = await gatherCandidates(denops, bufnr, range);
        return xs.map((b) => ({ value: b.target }));
      }, {
        suffix: ":target",
      });
      await initActionYank(denops, bufnr, async (denops, bufnr, range) => {
        const xs = await gatherCandidates(denops, bufnr, range);
        return xs.map((b) => ({ value: "commit" in b ? b.commit : "" }));
      }, {
        suffix: ":commit",
      });
      await option.filetype.setLocal(denops, "gin-branch");
    });
  });
}

async function gatherCandidates(
  denops: Denops,
  bufnr: number,
  [start, end]: Range,
): Promise<Branch[]> {
  const content = await fn.getbufline(
    denops,
    bufnr,
    Math.max(start, 1),
    Math.max(end, 1),
  );
  const result = parseBranch(content);
  return result.branches;
}
