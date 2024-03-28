import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import { define, GatherCandidates, Range } from "./core.ts";

export type Candidate = { commit: string; path?: string };

export async function init(
  denops: Denops,
  bufnr: number,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  await batch.batch(denops, async (denops) => {
    await define(
      denops,
      bufnr,
      "browse",
      (denops, bufnr, range) =>
        doBrowse(denops, bufnr, range, [], gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "browse:yank",
      (denops, bufnr, range) =>
        doBrowse(denops, bufnr, range, ["++yank"], gatherCandidates),
    );

    await define(
      denops,
      bufnr,
      "browse:permalink",
      (denops, bufnr, range) =>
        doBrowse(denops, bufnr, range, ["--permalink"], gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "browse:permalink:yank",
      (denops, bufnr, range) =>
        doBrowse(
          denops,
          bufnr,
          range,
          ["--permalink", "++yank"],
          gatherCandidates,
        ),
    );

    await define(
      denops,
      bufnr,
      "browse:commit",
      (denops, bufnr, range) =>
        doBrowse(denops, bufnr, range, ["--commit"], gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "browse:commit:yank",
      (denops, bufnr, range) =>
        doBrowse(
          denops,
          bufnr,
          range,
          ["--commit", "++yank"],
          gatherCandidates,
        ),
    );

    await define(
      denops,
      bufnr,
      "browse:commit:permalink",
      (denops, bufnr, range) =>
        doBrowse(
          denops,
          bufnr,
          range,
          ["--commit", "--permalink"],
          gatherCandidates,
        ),
    );
    await define(
      denops,
      bufnr,
      "browse:commit:permalink:yank",
      (denops, bufnr, range) =>
        doBrowse(
          denops,
          bufnr,
          range,
          ["--commit", "--permalink", "++yank"],
          gatherCandidates,
        ),
    );

    await define(
      denops,
      bufnr,
      "browse:pr",
      (denops, bufnr, range) =>
        doBrowse(denops, bufnr, range, ["--pr"], gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "browse:pr:yank",
      (denops, bufnr, range) =>
        doBrowse(denops, bufnr, range, ["--pr", "++yank"], gatherCandidates),
    );
  });
}

async function doBrowse(
  denops: Denops,
  bufnr: number,
  range: Range,
  extraArgs: string[],
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  for (const x of xs) {
    await denops.dispatch("gin", "browse:command", [
      ...extraArgs,
      ...(x.path ? [`--path=${x.path}`] : []),
      x.commit,
    ]);
  }
}
