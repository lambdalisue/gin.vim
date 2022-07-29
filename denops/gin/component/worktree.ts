import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import { Cache } from "https://deno.land/x/local_cache@1.0/mod.ts";
import * as path from "https://deno.land/std@0.150.0/path/mod.ts";
import { getWorktree } from "../util/worktree.ts";
import { find } from "../git/finder.ts";

type Data = string;

const cache = new Cache<string, Data>(100);

async function getData(
  denops: Denops,
): Promise<Data> {
  if (cache.has("data")) {
    return cache.get("data");
  }
  const cwd = await getWorktree(denops);
  const result = await find(cwd);
  cache.set("data", result);
  return result;
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
