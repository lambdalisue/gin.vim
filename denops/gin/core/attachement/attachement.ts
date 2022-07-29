import type { Denops } from "https://deno.land/x/denops_std@v3.3.0/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.3.0/autocmd/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.3.0/function/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.3.0/batch/mod.ts";

const winidAttachements: Map<number, Set<number>> = new Map();

export type Options = {
  targets?: number[];
};

export async function attachTo(
  denops: Denops,
  winid: number,
  options: Options = {},
): Promise<void> {
  const targets = options.targets ?? [await fn.win_getid(denops) as number];
  const attachements = winidAttachements.get(winid) ?? new Set();
  for (const target of targets) {
    attachements.add(target);
  }
  winidAttachements.set(winid, attachements);
  await init(denops, winid);
}

export async function detachFrom(
  denops: Denops,
  winid: number,
  options: Options = {},
): Promise<void> {
  const targets = options.targets ?? [await fn.win_getid(denops) as number];
  const attachements = winidAttachements.get(winid) ?? new Set();
  for (const target of targets) {
    attachements.delete(target);
  }
  winidAttachements.set(winid, attachements);
}

export async function closeAll(
  denops: Denops,
  winid: number,
): Promise<void> {
  const attachements = winidAttachements.get(winid);
  if (!attachements) {
    return;
  }
  try {
    await batch.batch(denops, async (denops) => {
      for (const attachement of attachements) {
        await fn.win_execute(denops, attachement, "quit");
      }
    });
  } finally {
    winidAttachements.delete(winid);
  }
}

async function init(denops: Denops, winid: number): Promise<void> {
  const bufnr = await fn.winbufnr(denops, winid);
  await autocmd.group(
    denops,
    "gin_core_attachement_attachement_init",
    (helper) => {
      helper.remove("*", `<buffer=${bufnr}>`);
      helper.define(
        "BufWinLeave",
        `<buffer=${bufnr}>`,
        `call denops#notify('gin', 'attachement:close_all', [${winid}])`,
      );
    },
  );
}
