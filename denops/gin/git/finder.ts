import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import { Cache } from "https://deno.land/x/ttl_cache@v0.1.1/mod.ts";
import { execute } from "./process.ts";
import { decodeUtf8 } from "../util/text.ts";

const ttl = 30000; // seconds
const cache = new Cache<string, string | Error>(ttl);

export async function find(cwd: string): Promise<string> {
  const result = cache.get(cwd) ?? await (async () => {
    let result: string | Error;
    try {
      result = await findInternal(cwd);
    } catch (e) {
      result = e;
    }
    cache.set(cwd, result);
    return result;
  })();
  if (result instanceof Error) {
    throw result;
  }
  return result;
}

async function findInternal(cwd: string): Promise<string> {
  const terms = cwd.split(path.SEP);
  if (terms.includes(".git")) {
    // `git rev-parse` does not work in a ".git" directory
    // so use a parent directory of it instead.
    const index = terms.indexOf(".git");
    cwd = terms.slice(0, index).join(path.SEP);
  }
  const stdout = await execute(
    [
      "rev-parse",
      "--show-toplevel",
      "--show-superproject-working-tree",
    ],
    {
      cwd,
    },
  );
  const output = decodeUtf8(stdout);
  return path.resolve(output.split(/\n/, 2)[0]);
}
