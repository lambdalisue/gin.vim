import { Cache } from "https://deno.land/x/local_cache@1.0/mod.ts";
import * as path from "https://deno.land/std@0.150.0/path/mod.ts";
import { execute } from "./process.ts";
import { decodeUtf8 } from "../util/text.ts";

const ttl = 30000; // seconds
const cache = new Cache<string, string | Error>(ttl);

export async function find(cwd: string): Promise<string> {
  let result: string | Error;
  if (cache.has(cwd)) {
    result = cache.get(cwd);
  } else {
    try {
      result = await findInternal(cwd);
    } catch (e) {
      result = e;
    }
    cache.set(cwd, result);
  }
  if (result instanceof Error) {
    throw result;
  }
  return result;
}

async function findInternal(cwd: string): Promise<string> {
  const terms = cwd.split(path.sep);
  if (terms.includes(".git")) {
    // `git rev-parse` does not work in a ".git" directory
    // so use a parent directory of it instead.
    const index = terms.indexOf(".git");
    cwd = terms.slice(0, index).join(path.sep);
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
