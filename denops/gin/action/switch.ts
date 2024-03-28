import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import { define, GatherCandidates, Range } from "./core.ts";

export type Candidate = { target: string };

export async function init(
  denops: Denops,
  bufnr: number,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  await batch.batch(denops, async (denops) => {
    await define(
      denops,
      bufnr,
      "switch",
      (denops, bufnr, range) =>
        doSwitch(denops, bufnr, range, [], gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "switch:detach",
      (denops, bufnr, range) =>
        doSwitch(denops, bufnr, range, ["--detach"], gatherCandidates),
    );
  });
}

async function doSwitch(
  denops: Denops,
  bufnr: number,
  range: Range,
  extraArgs: string[],
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const x = xs.at(0);
  if (!x) {
    return;
  }
  await denops.dispatch("gin", "command", "", [
    "switch",
    ...extraArgs,
    x.target,
  ]);
}
