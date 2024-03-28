import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v6.4.0/helper/mod.ts";
import {
  builtinOpts,
  formatOpts,
  parse,
  validateOpts,
} from "https://deno.land/x/denops_std@v6.4.0/argument/mod.ts";
import { fillCmdArgs, normCmdArgs, parseSilent } from "../../util/cmd.ts";
import { exec } from "./command.ts";
import { edit } from "./edit.ts";
import { read } from "./read.ts";
import { jumpNew, jumpOld, jumpSmart } from "./jump.ts";

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "diff:command": (bang, mods, args) => {
      assert(bang, is.String, { name: "bang" });
      assert(mods, is.String, { name: "mods" });
      assert(args, is.ArrayOf(is.String), { name: "args" });
      const silent = parseSilent(mods);
      return helper.ensureSilent(denops, silent, () => {
        return helper.friendlyCall(
          denops,
          () => command(denops, bang, mods, args),
        );
      });
    },
    "diff:edit": (bufnr, bufname) => {
      assert(bufnr, is.Number, { name: "bufnr" });
      assert(bufname, is.String, { name: "bufname" });
      return helper.friendlyCall(denops, () => edit(denops, bufnr, bufname));
    },
    "diff:read": (bufnr, bufname) => {
      assert(bufnr, is.Number, { name: "bufnr" });
      assert(bufname, is.String, { name: "bufname" });
      return helper.friendlyCall(denops, () => read(denops, bufnr, bufname));
    },
    "diff:jump:new": (mods) => {
      assert(mods, is.OptionalOf(is.String), { name: "mods" });
      return helper.friendlyCall(denops, () => jumpNew(denops, mods ?? ""));
    },
    "diff:jump:old": (mods) => {
      assert(mods, is.OptionalOf(is.String), { name: "mods" });
      return helper.friendlyCall(denops, () => jumpOld(denops, mods ?? ""));
    },
    "diff:jump:smart": (mods) => {
      assert(mods, is.OptionalOf(is.String), { name: "mods" });
      return helper.friendlyCall(denops, () => jumpSmart(denops, mods ?? ""));
    },
  };
}

async function command(
  denops: Denops,
  bang: string,
  mods: string,
  args: string[],
): Promise<void> {
  args = await fillCmdArgs(denops, args, "diff");
  args = await normCmdArgs(denops, args);

  const [opts, flags, residue] = parse(args);
  validateOpts(opts, [
    "processor",
    "worktree",
    "opener",
    ...builtinOpts,
  ]);
  const [commitish, paths] = parseResidue(residue);
  await exec(denops, {
    processor: opts.processor?.split(" "),
    worktree: opts.worktree,
    commitish,
    paths,
    flags,
    opener: opts.opener,
    cmdarg: formatOpts(opts, builtinOpts).join(" "),
    mods,
    bang: bang === "!",
  });
}

function parseResidue(residue: string[]): [string | undefined, string[]] {
  const index = residue.indexOf("--");
  const head = index === -1 ? residue : residue.slice(0, index);
  const tail = index === -1 ? [] : residue.slice(index + 1);
  // GinDiff [{options}]
  // GinDiff [{options}] {commitish}
  // GinDiff [{options}] -- {path}...
  // GinDiff [{options}] {commitish} -- {path}...
  switch (head.length) {
    case 0:
      return [undefined, tail];
    case 1:
      return [head[0], tail];
    default:
      throw new Error("Invalid number of arguments");
  }
}
