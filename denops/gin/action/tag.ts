import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v6.4.0/helper/mod.ts";
import { alias, define, GatherCandidates, Range } from "./core.ts";

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
      "tag:lightweight",
      (denops, bufnr, range) =>
        doTag(denops, bufnr, range, false, false, false, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "tag:annotate",
      (denops, bufnr, range) =>
        doTag(denops, bufnr, range, true, false, false, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "tag:sign",
      (denops, bufnr, range) =>
        doTag(denops, bufnr, range, false, true, false, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "tag:lightweight:force",
      (denops, bufnr, range) =>
        doTag(denops, bufnr, range, false, false, true, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "tag:annotate:force",
      (denops, bufnr, range) =>
        doTag(denops, bufnr, range, true, false, true, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "tag:sign:force",
      (denops, bufnr, range) =>
        doTag(denops, bufnr, range, false, true, true, gatherCandidates),
    );
    await alias(
      denops,
      bufnr,
      "tag",
      "tag:annotate",
    );
  });
}

async function doTag(
  denops: Denops,
  bufnr: number,
  range: Range,
  annotate: boolean,
  sign: boolean,
  force: boolean,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  for (const x of xs) {
    const name = await helper.input(denops, {
      prompt: `Name: `,
    });
    if (!name) {
      await helper.echo(denops, "Cancelled");
      return;
    }
    await denops.dispatch("gin", "command", "", [
      "tag",
      ...(annotate ? ["--annotate"] : []),
      ...(sign ? ["--sign"] : []),
      ...(force ? ["--force"] : []),
      name,
      x.commit,
    ]);
  }
}
