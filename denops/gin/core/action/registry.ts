import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import * as anonymous from "https://deno.land/x/denops_std@v3.5.0/anonymous/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.5.0/autocmd/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.5.0/function/mod.ts";
import type { Range } from "./action.ts";

export type { Range };

export type Candidate = {
  value: string;
  [key: string]: unknown;
};

export type Gatherer = (
  denops: Denops,
  range: Range,
) => Promise<Candidate[]>;

export async function register(
  denops: Denops,
  gatherer: Gatherer,
): Promise<void> {
  const bufnr = await fn.bufnr(denops);
  const pat = `<buffer=${bufnr}>`;
  const [id] = anonymous.once(denops, () => {
    registry.delete(bufnr);
  });
  await autocmd.group(
    denops,
    "gin_feat_action_registry_internal",
    (helper) => {
      helper.remove("*", pat);
      helper.define(
        "BufUnload",
        pat,
        `call denops#notify('gin', '${id}', [])`,
        {
          once: true,
        },
      );
    },
  );
  registry.set(bufnr, gatherer);
}

export async function gatherCandidates(
  denops: Denops,
  range: Range,
): Promise<Candidate[]> {
  const bufnr = await fn.bufnr(denops);
  const gatherer = registry.get(bufnr);
  if (!gatherer) {
    throw new Error(`No gatherer is registered on a buffer ${bufnr}`);
  }
  return await gatherer(denops, range);
}

// Global registry
const registry: Map<number, Gatherer> = new Map();
