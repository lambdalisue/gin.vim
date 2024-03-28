import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import { alias, define, GatherCandidates, Range } from "./core.ts";

export type Candidate = { path: string };

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
        `diff:local:${opener}`,
        (denops, bufnr, range) =>
          doDiff(denops, bufnr, range, opener, [], gatherCandidates),
      );
      await define(
        denops,
        bufnr,
        `diff:cached:${opener}`,
        (denops, bufnr, range) =>
          doDiff(
            denops,
            bufnr,
            range,
            opener,
            ["--cached"],
            gatherCandidates,
          ),
      );
      await define(
        denops,
        bufnr,
        `diff:HEAD:${opener}`,
        (denops, bufnr, range) =>
          doDiff(
            denops,
            bufnr,
            range,
            opener,
            ["HEAD"],
            gatherCandidates,
          ),
      );
    }
    await alias(
      denops,
      bufnr,
      "diff:local",
      "diff:local:edit",
    );
    await alias(
      denops,
      bufnr,
      "diff:cached",
      "diff:cached:edit",
    );
    await alias(
      denops,
      bufnr,
      "diff:HEAD",
      "diff:HEAD:edit",
    );
    await alias(
      denops,
      bufnr,
      "diff",
      "diff:local",
    );
  });
}

async function doDiff(
  denops: Denops,
  bufnr: number,
  range: Range,
  opener: string,
  extraArgs: string[],
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  for (const x of xs) {
    await denops.dispatch("gin", "diff:command", "", "", [
      `++opener=${opener}`,
      ...extraArgs,
      "--",
      x.path,
    ]);
  }
}
