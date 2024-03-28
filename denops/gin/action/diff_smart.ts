import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import { alias, define, GatherCandidates, Range } from "./core.ts";

export type Candidate = { path: string; XY: string };

export async function init(
  denops: Denops,
  bufnr: number,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  await batch.batch(denops, async (denops) => {
    const openers = [
      "edit",
      "split",
      "vsplit",
      "tabedit",
    ];
    for (const opener of openers) {
      await define(
        denops,
        bufnr,
        `diff:smart:${opener}`,
        (denops, bufnr, range) =>
          doDiffSmart(denops, bufnr, range, opener, gatherCandidates),
      );
    }
    await alias(
      denops,
      bufnr,
      "diff:smart",
      "diff:smart:edit",
    );
    await alias(
      denops,
      bufnr,
      "diff",
      "diff:smart",
    );
  });
}

async function doDiffSmart(
  denops: Denops,
  bufnr: number,
  range: Range,
  opener: string,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  for (const x of xs) {
    if (x.XY.startsWith(".")) {
      await denops.dispatch("gin", "diff:command", "", "", [
        `++opener=${opener}`,
        "--",
        x.path,
      ]);
    } else {
      await denops.dispatch("gin", "diff:command", "", "", [
        `++opener=${opener}`,
        "--cached",
        "--",
        x.path,
      ]);
    }
  }
}
