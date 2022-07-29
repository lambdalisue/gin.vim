import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import { Cache } from "https://deno.land/x/local_cache@1.0/mod.ts";
import { decodeUtf8 } from "../util/text.ts";
import { getWorktree } from "../util/worktree.ts";
import { execute } from "../git/process.ts";

type Data = [number, number];

const cache = new Cache<string, Data>(100);

async function getData(
  denops: Denops,
): Promise<Data> {
  if (cache.has("data")) {
    return cache.get("data");
  }
  const cwd = await getWorktree(denops);
  const result = await Promise.all([
    getAhead(cwd),
    getBehind(cwd),
  ]);
  cache.set("data", result);
  return result;
}

async function getAhead(cwd: string): Promise<number> {
  const stdout = await execute([
    "rev-list",
    "--count",
    "@{u}..HEAD",
  ], {
    noOptionalLocks: true,
    cwd,
  });
  return Number(decodeUtf8(stdout));
}

async function getBehind(cwd: string): Promise<number> {
  const stdout = await execute([
    "rev-list",
    "--count",
    "HEAD..@{u}",
  ], {
    noOptionalLocks: true,
    cwd,
  });
  return Number(decodeUtf8(stdout));
}

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "component:traffic:ascii": async () => {
      const [ahead, behind] = await getData(denops);
      let component = "";
      if (ahead) {
        component += `^${ahead}`;
      }
      if (behind) {
        component += `v${behind}`;
      }
      return component;
    },
    "component:traffic:unicode": async () => {
      const [ahead, behind] = await getData(denops);
      let component = "";
      if (ahead) {
        component += `↑${ahead}`;
      }
      if (behind) {
        component += `↓${behind}`;
      }
      return component;
    },
  };
}
