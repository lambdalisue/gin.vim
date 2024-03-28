import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import { define, GatherCandidates, Range } from "./core.ts";

export type Candidate = { path: string };

export async function init(
  denops: Denops,
  bufnr: number,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  await batch.batch(denops, async (denops) => {
    await define(
      denops,
      bufnr,
      "restore",
      (denops, bufnr, range) =>
        doRestore(
          denops,
          bufnr,
          range,
          ["--ignore-unmerged"],
          gatherCandidates,
        ),
    );
    await define(
      denops,
      bufnr,
      "restore:staged",
      (denops, bufnr, range) =>
        doRestore(
          denops,
          bufnr,
          range,
          ["--ignore-unmerged", "--staged"],
          gatherCandidates,
        ),
    );
    await define(
      denops,
      bufnr,
      "restore:ours",
      (denops, bufnr, range) =>
        doRestore(
          denops,
          bufnr,
          range,
          ["--ignore-unmerged", "--ours"],
          gatherCandidates,
        ),
    );
    await define(
      denops,
      bufnr,
      "restore:theirs",
      (denops, bufnr, range) =>
        doRestore(
          denops,
          bufnr,
          range,
          ["--ignore-unmerged", "--theirs"],
          gatherCandidates,
        ),
    );
    await define(
      denops,
      bufnr,
      "restore:conflict:merge",
      (denops, bufnr, range) =>
        doRestore(denops, bufnr, range, ["--conflict=merge"], gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "restore:conflict:diff3",
      (denops, bufnr, range) =>
        doRestore(denops, bufnr, range, ["--conflict=diff3"], gatherCandidates),
    );
  });
}

async function doRestore(
  denops: Denops,
  bufnr: number,
  range: Range,
  extraArgs: string[],
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  await denops.dispatch("gin", "command", "", [
    "restore",
    "--quiet",
    ...extraArgs,
    "--",
    ...xs.map((x) => x.path),
  ]);
}
