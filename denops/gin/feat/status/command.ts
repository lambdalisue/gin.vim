import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.5.0/autocmd/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.5.0/batch/mod.ts";
import * as bufname from "https://deno.land/x/denops_std@v3.5.0/bufname/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.5.0/function/mod.ts";
import * as option from "https://deno.land/x/denops_std@v3.5.0/option/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.5.0/variable/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as path from "https://deno.land/std@0.150.0/path/mod.ts";
import {
  formatFlags,
  parse,
  validateFlags,
  validateOpts,
} from "https://deno.land/x/denops_std@v3.5.0/argument/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v3.5.0/buffer/mod.ts";
import { normCmdArgs } from "../../util/cmd.ts";
import { getWorktreeFromOpts } from "../../util/worktree.ts";
import { Entry, GitStatusResult, parse as parseStatus } from "./parser.ts";
import { render } from "./render.ts";
import { execute } from "../../git/process.ts";
import { bind } from "../../core/bare/command.ts";
import {
  Candidate as CandidateBase,
  Range,
  register as registerGatherer,
} from "../../core/action/registry.ts";

type Candidate = Entry & CandidateBase;

export async function command(
  denops: Denops,
  args: string[],
): Promise<void> {
  const [opts, flags, _] = parse(await normCmdArgs(denops, args));
  validateOpts(opts, [
    "worktree",
  ]);
  validateFlags(flags, [
    "u",
    "untracked-files",
    "ignore-submodules",
    "ignored",
    "renames",
    "no-renames",
    "find-renames",
  ]);
  const worktree = await getWorktreeFromOpts(denops, opts);
  const bname = bufname.format({
    scheme: "ginstatus",
    expr: worktree,
    params: {
      "untracked-files": "all",
      ...flags,
    },
  });
  await buffer.open(denops, bname.toString());
}

export async function read(denops: Denops): Promise<void> {
  const [bufnr, bname] = await batch.gather(denops, async (denops) => {
    await fn.bufnr(denops, "%");
    await fn.bufname(denops, "%");
  });
  unknownutil.assertNumber(bufnr);
  unknownutil.assertString(bname);
  const { expr, params } = bufname.parse(bname);
  const flags = params ?? {};
  const args = [
    "status",
    "--porcelain=v2",
    "--branch",
    "--ahead-behind",
    "-z",
    ...formatFlags(flags),
  ];
  const [env, verbose] = await batch.gather(denops, async (denops) => {
    await fn.environ(denops);
    await option.verbose.get(denops);
  });
  unknownutil.assertObject(env, unknownutil.isString);
  unknownutil.assertNumber(verbose);
  const stdout = await execute(args, {
    printCommand: !!verbose,
    noOptionalLocks: true,
    cwd: expr,
    env,
  });
  const result = parseStatus(stdout);
  // Sort entries by its path
  result.entries.sort((a, b) =>
    a.path == b.path ? 0 : a.path > b.path ? 1 : -1
  );
  const content = render(result);
  await registerGatherer(denops, (denops, range) => {
    return getCandidates(denops, range, expr);
  });
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await bind(denops, bufnr);
      await option.filetype.setLocal(denops, "gin-status");
      await option.bufhidden.setLocal(denops, "unload");
      await option.buftype.setLocal(denops, "nofile");
      await option.swapfile.setLocal(denops, false);
      await option.modifiable.setLocal(denops, false);
      await vars.b.set(denops, "gin_status_result", result);
      await denops.call("gin#internal#feat#status#core#init");
      await autocmd.group(
        denops,
        `gin_feat_status_command_read_${bufnr}`,
        (helper) => {
          helper.remove();
          helper.define(
            ["BufWritePost", "FileWritePost"],
            "*",
            `call gin#util#reload(${bufnr})`,
          );
        },
      );
    });
  });
  await buffer.replace(denops, bufnr, content);
  await buffer.concrete(denops, bufnr);
}

async function getCandidates(
  denops: Denops,
  [start, end]: Range,
  worktree: string,
): Promise<Candidate[]> {
  const result = await vars.b.get(denops, "gin_status_result") as
    | GitStatusResult
    | null;
  if (!result || (start === end && start < 2)) {
    return [];
  }
  start = Math.max(start, 2);
  end = Math.max(end, 2);
  return result.entries.slice(start - 2, end - 2 + 1).map((entry) => ({
    ...entry,
    value: path.join(worktree, entry.path),
  }));
}
