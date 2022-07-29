import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.5.0/batch/mod.ts";
import * as bufname from "https://deno.land/x/denops_std@v3.5.0/bufname/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.5.0/function/mod.ts";
import * as option from "https://deno.land/x/denops_std@v3.5.0/option/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as fs from "https://deno.land/std@0.150.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.150.0/path/mod.ts";
import { GIN_BUFFER_PROTOCOLS } from "../global.ts";
import { expand } from "../util/cmd.ts";
import { Opts } from "https://deno.land/x/denops_std@v3.5.0/argument/mod.ts";
import { find } from "../git/finder.ts";

export async function getWorktree(denops: Denops): Promise<string> {
  const [cwd, filename, verbose] = await batch.gather(
    denops,
    async (denops) => {
      await fn.getcwd(denops);
      await fn.expand(denops, "%:p");
      await option.verbose.get(denops);
    },
  );
  unknownutil.assertString(cwd);
  unknownutil.assertString(filename);
  unknownutil.assertNumber(verbose);
  if (verbose) {
    console.debug("getWorktree");
    console.debug(`  cwd: ${cwd}`);
    console.debug(`  filename: ${filename}`);
  }
  if (filename) {
    try {
      const { scheme, expr } = bufname.parse(filename);
      if (GIN_BUFFER_PROTOCOLS.includes(scheme)) {
        return unknownutil.ensureString(
          await fn.fnamemodify(denops, expr, ":p"),
        );
      }
    } catch {
      // Ignore errors
    }
  }
  let candidates = new Set([cwd]);
  if (await fs.exists(filename)) {
    candidates.add(path.dirname(filename));
    const realpath = await Deno.realPath(filename);
    candidates.add(path.dirname(realpath));
  }
  candidates = new Set(Array.from(candidates).reverse());
  if (verbose) {
    console.debug(`  candidates: ${[...candidates]}`);
  }
  for (const c of candidates) {
    if (verbose) {
      console.debug(`Trying to find a git repository from '${c}'`);
    }
    try {
      return await find(c);
    } catch {
      // Fail silently
    }
  }
  throw new Error(
    `No git repository found (searched from ${
      [...candidates.values()].join(", ")
    })`,
  );
}

export async function getWorktreeFromOpts(
  denops: Denops,
  opts: Opts,
): Promise<string> {
  const worktree = opts["worktree"]
    ? await find(await expand(denops, opts["worktree"]))
    : await getWorktree(denops);
  return worktree;
}
