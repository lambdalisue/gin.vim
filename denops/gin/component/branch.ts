import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { Cache } from "https://deno.land/x/ttl_cache@v0.1.1/mod.ts";
import { decodeUtf8 } from "../util/text.ts";
import { findWorktreeFromDenops } from "../git/worktree.ts";
import { execute } from "../git/process.ts";

type Data = [string, string];

const cache = new Cache<string, Data>(100);

async function getData(
  denops: Denops,
): Promise<Data> {
  return cache.get("data") ?? await (async () => {
    const worktree = await findWorktreeFromDenops(denops);
    const result = await getBranches(worktree);
    cache.set("data", result);
    return result;
  })();
}

async function getBranches(
  cwd: string,
): Promise<Data> {
  let stdout: Uint8Array;
  try {
    stdout = await execute([
      "rev-parse",
      "--abbrev-ref",
      "--symbolic-full-name",
      "HEAD",
      "@{u}",
    ], {
      noOptionalLocks: true,
      cwd,
    });
  } catch {
    stdout = await execute([
      "branch",
      "--show-current",
    ], {
      noOptionalLocks: true,
      cwd,
    });
  }
  const [branch, upstream] = decodeUtf8(stdout).split("\n");
  return [branch, upstream];
}

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "component:branch:ascii": async () => {
      const [branch, upstream] = await getData(denops);
      if (branch && upstream) {
        return `${branch} -> ${upstream}`;
      }
      return branch;
    },
    "component:branch:unicode": async () => {
      const [branch, upstream] = await getData(denops);
      if (branch && upstream) {
        return `${branch} → ${upstream}`;
      }
      return branch;
    },
  };
}
