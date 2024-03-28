import type { Denops } from "https://deno.land/x/denops_std@v6.0.1/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.0.1/batch/mod.ts";
import { parse as parseBufname } from "https://deno.land/x/denops_std@v6.0.1/bufname/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.0.1/function/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import { GIN_BUFFER_PROTOCOLS } from "../global.ts";
import { expand } from "../util/expand.ts";
import { find } from "./finder.ts";

/**
 * Find a git worktree from a suspected directory
 */
async function findWorktreeFromSuspect(
  suspect: string,
  verbose?: boolean,
): Promise<string> {
  // Check if 'anchor' is a gin buffer name
  try {
    const { scheme, expr } = parseBufname(suspect);
    if (verbose) {
      console.debug(`The anchor scheme is '${scheme}' and expr is '${expr}'`);
    }
    if (GIN_BUFFER_PROTOCOLS.includes(scheme)) {
      // GIN_BUFFER_PROTOCOLS always records an absolute path in `expr`
      return expr;
    }
  } catch {
    // Failed to execute 'parseBufname(suspect)' means that the 'suspect' seems a real filepath.
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
async function findWorktreeFromSuspects(
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
async function listWorktreeSuspectsFromDenops(
  denops: Denops,
  verbose?: boolean,
): Promise<string[]> {
  const [cwd, bufname] = await batch.collect(
    denops,
    (denops) => [
      fn.getcwd(denops),
      fn.expand(denops, "%:p") as Promise<string>,
    ],
  );
  if (verbose) {
    console.debug("listWorktreeSuspectsFromDenops");
    console.debug(`  cwd: ${cwd}`);
    console.debug(`  bufname: ${bufname}`);
  }
  return [bufname, cwd];
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

/**
 * Find a git worktree from the host environment
 */
export async function findWorktreeFromDenops(
  denops: Denops,
  options: FindWorktreeFromDenopsOptions = {},
): Promise<string> {
  return await findWorktreeFromSuspects(
    options.worktree
      ? [await expand(denops, options.worktree)]
      : await listWorktreeSuspectsFromDenops(denops, !!options.verbose),
    !!options.verbose,
  );
}

export type FindWorktreeFromDenopsOptions = {
  worktree?: string;
  verbose?: boolean;
};
