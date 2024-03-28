import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import { define, GatherCandidates, Range } from "./core.ts";

export type Candidate =
  | { kind: "remote"; branch: string; remote: string }
  | { kind?: "alias" | "local"; branch: string };

export async function init(
  denops: Denops,
  bufnr: number,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  await batch.batch(denops, async (denops) => {
    await define(
      denops,
      bufnr,
      "delete",
      (denops, bufnr, range) =>
        doDelete(denops, bufnr, range, false, gatherCandidates),
    );
    await define(
      denops,
      bufnr,
      "delete:force",
      (denops, bufnr, range) =>
        doDelete(denops, bufnr, range, true, gatherCandidates),
    );
  });
}

async function doDelete(
  denops: Denops,
  bufnr: number,
  range: Range,
  force: boolean,
  gatherCandidates: GatherCandidates<Candidate>,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  for (const x of xs) {
    switch (x.kind) {
      case "alias":
        continue;
      case "remote":
        await denops.dispatch("gin", "command", "", [
          "push",
          "--delete",
          x.remote,
          x.branch,
        ]);
        break;
      default:
        await denops.dispatch("gin", "command", "", [
          "branch",
          force ? "-D" : "-d",
          x.branch,
        ]);
        break;
    }
  }
}
