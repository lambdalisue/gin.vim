import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import { define, GatherCandidates, Range } from "./core.ts";

export type Candidate = { commit: string };

export async function init(
  denops: Denops,
  bufnr: number,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  await batch.batch(denops, async (denops) => {
    await define(
      denops,
      bufnr,
      "reset",
      (denops, bufnr, range) =>
        doReset(denops, bufnr, range, "", gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "reset:soft",
      (denops, bufnr, range) =>
        doReset(denops, bufnr, range, "soft", gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "reset:hard",
      (denops, bufnr, range) =>
        doReset(denops, bufnr, range, "hard", gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "reset:merge",
      (denops, bufnr, range) =>
        doReset(denops, bufnr, range, "merge", gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "reset:keep",
      (denops, bufnr, range) =>
        doReset(denops, bufnr, range, "keep", gatherCandidates),
    );
  });
}

export async function doReset(
  denops: Denops,
  bufnr: number,
  range: Range,
  mode: "" | "soft" | "hard" | "merge" | "keep",
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const x = xs.at(0);
  if (!x) {
    return;
  }
  await denops.dispatch("gin", "command", "", [
    "reset",
    "--quiet",
    ...(mode ? [`--${mode}`] : []),
    x.commit,
  ]);
}
