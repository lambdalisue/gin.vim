import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { unnullish } from "https://deno.land/x/unnullish@v1.0.1/mod.ts";
import {
  assert,
  ensure,
  is,
} from "https://deno.land/x/unknownutil@v3.17.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v6.4.0/helper/mod.ts";
import {
  parse,
  validateOpts,
} from "https://deno.land/x/denops_std@v6.4.0/argument/mod.ts";
import { fillCmdArgs, normCmdArgs } from "../../util/cmd.ts";
import { exec } from "./command.ts";

type Range = readonly [number, number];

const isRange = is.TupleOf([is.Number, is.Number] as const);

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "browse:command": (args, range) => {
      assert(args, is.ArrayOf(is.String), { name: "args" });
      assert(range, is.OneOf([is.Undefined, isRange]), { name: "range" });
      return helper.friendlyCall(
        denops,
        () =>
          command(denops, args, {
            range,
          }),
      );
    },
  };
}

type CommandOptions = {
  range?: Range;
};

async function command(
  denops: Denops,
  args: string[],
  options: CommandOptions = {},
): Promise<void> {
  args = await fillCmdArgs(denops, args, "browse");
  args = await normCmdArgs(denops, args);

  const [opts, flags, residue] = parse(args);
  validateOpts(opts, [
    "worktree",
    "yank",
  ]);

  const commitish = parseResidue(residue);
  const path = unnullish(
    await ensurePath(denops, flags["path"]),
    (p) => formatPath(p, options.range),
  );
  await exec(denops, commitish ?? "HEAD", {
    worktree: opts.worktree,
    yank: opts.yank === "" ? true : (opts.yank ?? false),
    noBrowser: ("n" in flags || "no-browser" in flags),
    remote: ensure(flags.remote, is.OneOf([is.Undefined, is.String]), {
      "message": "REMOTE in --remote={REMOTE} must be string",
    }),
    path,
    home: "home" in flags,
    commit: "commit" in flags,
    pr: "pr" in flags,
    permalink: "permalink" in flags,
  });
}

function parseResidue(
  residue: string[],
): string | undefined {
  // GinBrowse [{options}] {commitish}
  switch (residue.length) {
    case 0:
      return undefined;
    case 1:
      return residue[0];
    default:
      throw new Error("Invalid number of arguments");
  }
}

async function ensurePath(
  denops: Denops,
  path?: unknown,
): Promise<string | undefined> {
  if (path) {
    return ensure(path, is.String, {
      message: "PATH in --path={PATH} must be string",
    });
  }
  const [bufname, buftype, cwd] = await batch.collect(denops, (denops) => [
    fn.expand(denops, "%:p") as Promise<string>,
    fn.getbufvar(denops, "%", "&buftype") as Promise<string>,
    fn.getcwd(denops),
  ]);
  return buftype ? cwd : bufname;
}

function formatPath(path: string, range?: Range): string {
  if (!range) {
    return path;
  }
  const [start, end] = range;
  if (start === end) {
    return `${path}:${start}`;
  }
  return `${path}:${start}:${end}`;
}
