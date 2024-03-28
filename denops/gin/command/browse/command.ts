import type { Denops } from "https://deno.land/x/denops_std@v6.0.1/mod.ts";
import { unnullish } from "https://deno.land/x/unnullish@v1.0.1/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import { systemopen } from "https://deno.land/x/systemopen@v0.2.0/mod.ts";
import {
  getURL,
  Options,
} from "https://deno.land/x/git_browse@v1.0.1/bin/browse.ts";
import * as batch from "https://deno.land/x/denops_std@v6.0.1/batch/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v6.0.1/variable/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.0.1/option/mod.ts";
import { findWorktreeFromDenops } from "../../git/worktree.ts";
import { yank } from "../../util/yank.ts";

export type ExecOptions = Omit<Options, "cwd" | "aliases"> & {
  worktree?: string;
  yank?: string | boolean;
  noBrowser?: boolean;
};

export async function exec(
  denops: Denops,
  commitish: string,
  options: ExecOptions = {},
): Promise<void> {
  const [verbose, aliases] = await batch.collect(denops, (denops) => [
    option.verbose.get(denops),
    vars.g.get(denops, "gin_browse_aliases", {}),
  ]);
  assert(aliases, is.RecordOf(is.String), {
    name: "g:gin_browse_aliases",
  });

  const worktree = await findWorktreeFromDenops(denops, {
    worktree: options.worktree,
    verbose: !!verbose,
  });

  options.path = unnullish(
    options.path,
    (p) => path.isAbsolute(p) ? path.relative(worktree, p) : p,
  );
  options.path = unnullish(
    options.path,
    (p) => p === "" ? "." : p,
  );
  const url = await getURL(commitish, {
    cwd: worktree,
    remote: options.remote,
    path: options.path,
    home: options.home,
    commit: options.commit,
    pr: options.pr,
    permalink: options.permalink,
    aliases,
  });

  if (options.yank != null && options.yank !== false) {
    await yank(
      denops,
      url.href,
      options.yank === true ? undefined : options.yank,
    );
  }
  if (options.noBrowser) {
    await denops.cmd("echomsg url", { url: url.href });
  } else {
    await systemopen(url.href);
  }
}
