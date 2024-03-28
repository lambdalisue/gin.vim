import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v6.4.0/helper/mod.ts";
import {
  builtinOpts,
  formatOpts,
  parseOpts,
  validateOpts,
} from "https://deno.land/x/denops_std@v6.4.0/argument/mod.ts";
import { fillCmdArgs, normCmdArgs, parseSilent } from "../../util/cmd.ts";
import { exec } from "./command.ts";

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "patch:command": (bang, mods, args) => {
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
  };
}

async function command(
  denops: Denops,
  bang: string,
  mods: string,
  args: string[],
): Promise<void> {
  args = await fillCmdArgs(denops, args, "patch");
  args = await normCmdArgs(denops, args);

  const [opts, residue] = parseOpts(args);
  validateOpts(opts, [
    "worktree",
    "opener",
    "no-head",
    "no-worktree",
    ...builtinOpts,
  ]);

  const [abspath] = parseResidue(residue);
  await exec(denops, abspath, {
    worktree: opts.worktree,
    noHead: "no-head" in opts,
    noWorktree: "no-worktree" in opts,
    opener: opts.opener,
    cmdarg: formatOpts(opts, builtinOpts).join(" "),
    mods,
    bang: bang === "!",
  });
}

function parseResidue(
  residue: string[],
): [string] {
  // GinPatch [{options}] {path}
  switch (residue.length) {
    case 1:
      return [residue[0]];
    default:
      throw new Error("Invalid number of arguments");
  }
}
