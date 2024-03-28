import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import { define, GatherCandidates, Range } from "./core.ts";
import { doResetFile } from "./reset_file.ts";

export type Candidate = { path: string; XY: string };

export async function init(
  denops: Denops,
  bufnr: number,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  await batch.batch(denops, async (denops) => {
    await define(
      denops,
      bufnr,
      "stage",
      (denops, bufnr, range) => doStage(denops, bufnr, range, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "stage:intent-to-add",
      (denops, bufnr, range) =>
        doStageIntentToAdd(denops, bufnr, range, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "unstage",
      (denops, bufnr, range) =>
        doResetFile(denops, bufnr, range, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "unstage:intent-to-add",
      (denops, bufnr, range) =>
        doUnstageIntentToAdd(denops, bufnr, range, gatherCandidates),
    );
  });
}

async function doStage(
  denops: Denops,
  bufnr: number,
  range: Range,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const xsRemoved = xs.filter((x) => x.XY.endsWith("D"));
  const xsOthers = xs.filter((x) => !x.XY.endsWith(".") && !x.XY.endsWith("D"));
  if (xsRemoved.length) {
    await denops.dispatch("gin", "command", "", [
      "rm",
      "--quiet",
      "--ignore-unmatch",
      "--cached",
      "--",
      ...xsRemoved.map((x) => x.path),
    ]);
  }
  if (xsOthers.length) {
    await denops.dispatch("gin", "command", "", [
      "add",
      "--ignore-errors",
      "--force",
      "--",
      ...xsOthers.map((x) => x.path),
    ]);
  }
}

async function doStageIntentToAdd(
  denops: Denops,
  bufnr: number,
  range: Range,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const xsUnknown = xs.filter((x) => x.XY === "??");
  const xsRemoved = xs.filter((x) => x.XY.endsWith("D"));
  const xsOthers = xs.filter((x) => x.XY !== "??" && !x.XY.endsWith("D"));
  if (xsUnknown.length) {
    await denops.dispatch("gin", "command", "", [
      "add",
      "--ignore-errors",
      "--force",
      "--intent-to-add",
      "--",
      ...xsUnknown.map((x) => x.path),
    ]);
  }
  if (xsRemoved.length) {
    await denops.dispatch("gin", "command", "", [
      "rm",
      "--quiet",
      "--ignore-unmatch",
      "--cached",
      "--",
      ...xsRemoved.map((x) => x.path),
    ]);
  }
  if (xsOthers.length) {
    await denops.dispatch("gin", "command", "", [
      "add",
      "--ignore-errors",
      "--force",
      "--",
      ...xsOthers.map((x) => x.path),
    ]);
  }
}

async function doUnstageIntentToAdd(
  denops: Denops,
  bufnr: number,
  range: Range,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const xsAdded = xs.filter((x) => x.XY === "A.");
  const xsOthers = xs.filter((x) => x.XY !== "A.");
  if (xsAdded.length) {
    await denops.dispatch("gin", "command", "", [
      "reset",
      "--quiet",
      "--",
      ...xsAdded.map((x) => x.path),
    ]);
    await denops.dispatch("gin", "command", "", [
      "add",
      "--ignore-errors",
      "--force",
      "--intent-to-add",
      "--",
      ...xsAdded.map((x) => x.path),
    ]);
  }
  if (xsOthers.length) {
    await denops.dispatch("gin", "command", "", [
      "reset",
      "--quiet",
      "--",
      ...xsOthers.map((x) => x.path),
    ]);
  }
}
