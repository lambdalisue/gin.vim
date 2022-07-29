import type { Denops } from "https://deno.land/x/denops_std@v3.3.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.3.0/batch/mod.ts";
import * as bufname from "https://deno.land/x/denops_std@v3.3.0/bufname/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.3.0/function/mod.ts";
import * as path from "https://deno.land/std@0.133.0/path/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import { GIN_BUFFER_PROTOCOLS } from "../global.ts";
import { find } from "../git/finder.ts";

/**
 * Find a git worktree from a suspected directory
 */
export async function findWorktreeFromSuspect(
  suspect: string,
  verbose?: boolean,
): Promise<string> {
  // Check if 'anchor' is a gin buffer name
  try {
    const { scheme, expr } = bufname.parse(suspect);
    if (verbose) {
      console.debug(`The anchor scheme is '${scheme}' and expr is '${expr}'`);
    }
    if (GIN_BUFFER_PROTOCOLS.includes(scheme)) {
      // GIN_BUFFER_PROTOCOLS always records an absolute path in `expr`
      return expr;
    }
  } catch {
    // Failed to execute 'bufname.parse(suspect)' means that the 'suspect' seems a real filepath.
    const candidates = new Set(await normSuspect(suspect));
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
  }
  throw new Error(`No git repository found (searched from ${suspect})`);
}

/**
 * Find a git worktree from suspected directories
 */
export async function findWorktreeFromSuspects(
  suspects: string[],
  verbose?: boolean,
): Promise<string> {
  for (const suspect of suspects) {
    try {
      return await findWorktreeFromSuspect(suspect, verbose);
    } catch {
      // Fail silently
    }
  }
  throw new Error(
    `No git repository found (searched from ${
      [...suspects.values()].join(", ")
    })`,
  );
}

/**
 * Return candidates of worktree anchor directories from the host environment
 */
export async function listWorktreeSuspectsFromDenops(
  denops: Denops,
  verbose?: boolean,
): Promise<string[]> {
  const [cwd, bname] = await batch.gather(
    denops,
    async (denops) => {
      await fn.getcwd(denops);
      await fn.expand(denops, "%:p");
    },
  );
  unknownutil.assertString(cwd);
  unknownutil.assertString(bname);
  if (verbose) {
    console.debug("listWorktreeSuspectsFromDenops");
    console.debug(`  cwd: ${cwd}`);
    console.debug(`  bname: ${bname}`);
  }
  return [bname, cwd];
}

async function normSuspect(suspect: string): Promise<string[]> {
  try {
    const [stat, lstat] = await Promise.all([
      Deno.stat(suspect),
      Deno.lstat(suspect),
    ]);
    if (lstat.isSymlink) {
      if (stat.isFile) {
        return [
          path.dirname(suspect),
          path.dirname(await Deno.realPath(suspect)),
        ];
      } else {
        return [
          suspect,
          await Deno.realPath(suspect),
        ];
      }
    } else {
      if (stat.isFile) {
        return [path.dirname(suspect)];
      } else {
        return [suspect];
      }
    }
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return [];
    }
    throw err;
  }
}
