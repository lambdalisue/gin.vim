import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v6.4.0/helper/mod.ts";
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
      "rebase",
      (denops, bufnr, range) =>
        doRebase(denops, bufnr, range, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "rebase:i",
      (denops, bufnr, range) =>
        doRebaseInteractive(denops, bufnr, range, gatherCandidates),
    );
  });
}

async function doRebase(
  denops: Denops,
  bufnr: number,
  range: Range,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const x = xs.at(0);
  if (!x) {
    return;
  }
  await denops.dispatch("gin", "command", "", [
    "rebase",
    x.commit,
  ]);

  // suppress false-positive detection of file changes
  await denops.cmd("silent checktime");
}

async function doRebaseInteractive(
  denops: Denops,
  bufnr: number,
  range: Range,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const x = xs.at(0);
  if (!x) {
    return;
  }
  // NOTE:
  // We must NOT await the command otherwise Vim would freeze
  // because command proxy could not work if we await here.
  denops.dispatch("gin", "command", "", [
    "rebase",
    "--interactive",
    x.commit,
  ]).catch(async (e) => {
    await helper.echoerr(denops, e.toString());
  }).then(
    // suppress false-positive detection of file changes
    // NOTE: must be done on resolve because the rebase is not awaited
    () => denops.cmd("silent checktime"),
  );
}
