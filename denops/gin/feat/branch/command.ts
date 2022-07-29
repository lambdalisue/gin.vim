import type { Denops } from "https://deno.land/x/denops_std@v3.3.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.3.0/batch/mod.ts";
import * as bufname from "https://deno.land/x/denops_std@v3.3.0/bufname/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.3.0/function/mod.ts";
import * as option from "https://deno.land/x/denops_std@v3.3.0/option/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.3.0/variable/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import {
  formatFlags,
  parse,
  validateFlags,
  validateOpts,
} from "https://deno.land/x/denops_std@v3.3.0/argument/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v3.3.0/buffer/mod.ts";
import { expand, normCmdArgs } from "../../util/cmd.ts";
import {
  findWorktreeFromSuspects,
  listWorktreeSuspectsFromDenops,
} from "../../util/worktree.ts";
import { execute } from "../../git/process.ts";
import { bind } from "../../core/bare/command.ts";
import { Branch, GitBranchResult, parse as parseBranch } from "./parser.ts";
import { render } from "./render.ts";
import {
  Candidate as CandidateBase,
  Range,
  register as registerGatherer,
} from "../../core/action/registry.ts";

type Candidate = Branch & CandidateBase;

export type Options = {
  worktree?: string;
  extraArgs?: string;
  opener?: string;
  cmdarg?: string;
  mods?: string;
};

export async function command(
  denops: Denops,
  mods: string,
  args: string[],
): Promise<void> {
  const [opts, flags, residue] = parse(await normCmdArgs(denops, args));
  validateOpts(opts, ["worktree"]);
  validateFlags(flags, [
    "a",
    "all",
    "r",
    "remotes",
    "i",
    "ignore-case",
    "abbrev",
    "no-abbrev",
  ]);
  const options = {
    worktree: opts["worktree"],
    extraArgs: residue.join(" "),
    mods,
  };
  await exec(denops, flags, options);
}

export async function exec(
  denops: Denops,
  params: bufname.BufnameParams,
  options: Options = {},
): Promise<buffer.OpenResult> {
  const [verbose] = await batch.gather(
    denops,
    async (denops) => {
      await option.verbose.get(denops);
    },
  );
  unknownutil.assertNumber(verbose);

  const worktree = await findWorktreeFromSuspects(
    options.worktree
      ? [await expand(denops, options.worktree)]
      : await listWorktreeSuspectsFromDenops(denops, !!verbose),
    !!verbose,
  );
  const bname = bufname.format({
    scheme: "ginbranch",
    expr: worktree,
    params,
    fragment: options.extraArgs,
  });
  return await buffer.open(denops, bname.toString(), {
    opener: options.opener,
    cmdarg: options.cmdarg,
    mods: options.mods,
  });
}

export async function read(denops: Denops): Promise<void> {
  const [bufnr, bname, env, verbose] = await batch.gather(
    denops,
    async (denops) => {
      await fn.bufnr(denops, "%");
      await fn.bufname(denops, "%");
      await fn.environ(denops);
      await option.verbose.get(denops);
    },
  ) as [number, string, Record<string, string>, number];
  const { expr, params, fragment } = bufname.parse(bname);
  const flags = params ?? {};
  const args = [
    "branch",
    "--list",
    "-vv",
    ...formatFlags(flags),
    ...(fragment ? [fragment] : []),
  ];
  const stdout = await execute(args, {
    printCommand: !!verbose,
    noOptionalLocks: true,
    cwd: expr,
    env,
  });
  const result = parseBranch(stdout);
  // Sort branches by its branch name
  result.branches.sort((a, b) =>
    a.target == b.target ? 0 : a.target > b.target ? 1 : -1
  );
  const content = render(result);
  await registerGatherer(denops, bufnr, getCandidates);
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await bind(denops, bufnr);
      await option.filetype.setLocal(denops, "gin-branch");
      await option.bufhidden.setLocal(denops, "unload");
      await option.buftype.setLocal(denops, "nofile");
      await option.swapfile.setLocal(denops, false);
      await option.modifiable.setLocal(denops, false);
      await vars.b.set(denops, "gin_branch_result", result);
      await denops.call("gin#internal#feat#branch#core#init");
    });
  });
  await buffer.replace(denops, bufnr, content);
  await buffer.concrete(denops, bufnr);
}

async function getCandidates(
  denops: Denops,
  bufnr: number,
  [start, end]: Range,
): Promise<Candidate[]> {
  const result = (await fn.getbufvar(denops, bufnr, "gin_branch_result")) as
    | GitBranchResult
    | null;
  if (!result) {
    return [];
  }
  start = Math.max(start, 1);
  end = Math.max(end, 1);
  return result.branches.slice(start - 1, end - 1 + 1).map((branch) => ({
    ...branch,
    value: branch.branch,
  }));
}
