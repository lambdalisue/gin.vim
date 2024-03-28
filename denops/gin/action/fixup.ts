import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
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
      "fixup:fixup",
      (denops, bufnr, range) =>
        doFixup(denops, bufnr, range, gatherCandidates, false),
    );
    await define(
      denops,
      bufnr,
      "fixup:instant-fixup",
      (denops, bufnr, range) =>
        doFixup(denops, bufnr, range, gatherCandidates, true),
    );

    const kinds = ["amend", "reword"] as const;
    for (const kind of kinds) {
      for (const instant of [true, false]) {
        await define(
          denops,
          bufnr,
          instant ? `fixup:instant-${kind}` : `fixup:${kind}`,
          (denops, bufnr, range) =>
            doFixupInteractive(
              denops,
              bufnr,
              range,
              kind,
              gatherCandidates,
              instant,
            ),
        );
      }
    }

    await alias(
      denops,
      bufnr,
      "fixup",
      "fixup:fixup",
    );
  });
}

async function doInstantSquash(denops: Denops, commit: string): Promise<void> {
  // autosquash without opening an editor
  await denops.dispatch("gin", "command", "", [
    "-c",
    "sequence.editor=true",
    "rebase",
    "--interactive",
    "--autostash",
    "--autosquash",
    "--quiet",
    `${commit}~`,
  ]);

  // suppress false-positive detection of file changes
  await denops.cmd("silent checktime");
}

async function doFixup(
  denops: Denops,
  bufnr: number,
  range: Range,
  gatherCandidates: GatherCandidates<Candidate>,
  instant: boolean,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const commit = xs.map((v) => v.commit).join("\n");
  await denops.dispatch("gin", "command", "", [
    "commit",
    `--fixup=${commit}`,
  ]);

  if (instant) {
    await doInstantSquash(denops, `${commit}~`);
  }
}

async function doFixupInteractive(
  denops: Denops,
  bufnr: number,
  range: Range,
  kind: "amend" | "reword",
  gatherCandidates: GatherCandidates<Candidate>,
  instant: boolean,
): Promise<void> {
  const xs = await gatherCandidates(denops, bufnr, range);
  const commit = xs.map((v) => v.commit).join("\n");
  // Do not block Vim so that users can edit commit message
  const args = ["commit", `--fixup=${kind}:${commit}`];
  if (instant) {
    args.push("--quiet");
  }
  denops
    .dispatch("gin", "command", "", args)
    .then(
      instant ? () => doInstantSquash(denops, `${commit}~`) : undefined,
      (e) => console.error(`failed to execute git commit: ${e}`),
    );
}
