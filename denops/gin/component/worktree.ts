import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { Cache } from "https://deno.land/x/ttl_cache@v0.1.1/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import { findWorktreeFromDenops } from "../git/worktree.ts";
import { find } from "../git/finder.ts";

type Data = string;

const cache = new Cache<string, Data>(100);

async function getData(
  denops: Denops,
): Promise<Data> {
  return cache.get("data") ?? await (async () => {
    const worktree = await findWorktreeFromDenops(denops);
    const result = await find(worktree);
    cache.set("data", result);
    return result;
  })();
}

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "component:worktree:full": async () => {
      const fullpath = await getData(denops);
      return fullpath;
    },
    "component:worktree:name": async () => {
      const fullpath = await getData(denops);
      return path.basename(fullpath);
    },
  };
}
