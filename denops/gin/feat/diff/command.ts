import type { Denops } from "https://deno.land/x/denops_std@v3.3.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.3.0/batch/mod.ts";
import * as bufname from "https://deno.land/x/denops_std@v3.3.0/bufname/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.3.0/function/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v3.3.0/helper/mod.ts";
import * as mapping from "https://deno.land/x/denops_std@v3.3.0/mapping/mod.ts";
import * as option from "https://deno.land/x/denops_std@v3.3.0/option/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.3.0/variable/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as path from "https://deno.land/std@0.133.0/path/mod.ts";
import {
  builtinOpts,
  formatFlags,
  formatOpts,
  parse,
  parseOpts,
  validateFlags,
  validateOpts,
} from "https://deno.land/x/denops_std@v3.3.0/argument/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v3.3.0/buffer/mod.ts";
import { expand, normCmdArgs } from "../../util/cmd.ts";
import {
  findWorktreeFromSuspects,
  listWorktreeSuspectsFromDenops,
} from "../../util/worktree.ts";
import { decodeUtf8 } from "../../util/text.ts";
import { run } from "../../git/process.ts";
import { findJumpNew, findJumpOld } from "./jump.ts";
import { command as editCommand } from "../edit/command.ts";
import { INDEX, parseCommitish, WORKTREE } from "./commitish.ts";

export type Options = {
  worktree?: string;
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
  validateOpts(opts, [
    "worktree",
    ...builtinOpts,
  ]);
  validateFlags(flags, [
    "R",
    "b",
    "w",
    "I",
    "cached",
    "renames",
    "diff-filter",
    "ignore-cr-at-eol",
    "ignore-space-at-eol",
    "ignore-space-change",
    "ignore-all-space",
    "ignore-blank-lines",
    "ignore-matching-lines",
    "ignore-submodules",
  ]);
  const [commitish, abspath] = parseResidue(residue);
  const options = {
    worktree: opts["worktree"],
    cmdarg: formatOpts(opts, builtinOpts).join(" "),
    mods,
  };
  await exec(denops, abspath, commitish, flags, options);
}

export async function exec(
  denops: Denops,
  filename: string,
  commitish: string | undefined,
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
  const relpath = path.relative(worktree, filename);
  const bname = bufname.format({
    scheme: "gindiff",
    expr: worktree,
    params: {
      ...params,
      commitish,
    },
    fragment: relpath,
  });
  return await buffer.open(denops, bname.toString(), {
    opener: options.opener,
    cmdarg: options.cmdarg,
    mods: options.mods,
  });
}

export async function read(denops: Denops): Promise<void> {
  const [env, verbose, bufnr, bname, cmdarg, disableDefaultMappings] =
    await batch.gather(
      denops,
      async (denops) => {
        await fn.environ(denops);
        await option.verbose.get(denops);
        await fn.bufnr(denops, "%");
        await fn.bufname(denops, "%");
        await vars.v.get(denops, "cmdarg");
        await vars.g.get(
          denops,
          "gin_diff_disable_default_mappings",
          false,
        );
      },
    ) as [Record<string, string>, number, number, string, string, unknown];
  unknownutil.assertBoolean(disableDefaultMappings);
  const [opts, _] = parseOpts(cmdarg.split(" "));
  validateOpts(opts, builtinOpts);
  const { expr, params, fragment } = bufname.parse(bname);
  if (!fragment) {
    throw new Error("A buffer 'gindiff://' requires a fragment part");
  }
  const flags = {
    ...params ?? {},
    commitish: undefined,
  };
  const args = [
    "diff",
    "--no-color",
    ...formatFlags(flags),
    ...(params?.commitish ? [unknownutil.ensureString(params.commitish)] : []),
    fragment,
  ];
  const proc = run(args, {
    printCommand: !!verbose,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
    noOptionalLocks: true,
    cwd: expr,
    env,
  });
  const [status, stdout, stderr] = await Promise.all([
    proc.status(),
    proc.output(),
    proc.stderrOutput(),
  ]);
  proc.close();
  if (!status.success) {
    await denops.cmd("echohl Error");
    await helper.echo(denops, decodeUtf8(stderr));
    await denops.cmd("echohl None");
    return;
  }
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await option.filetype.setLocal(denops, "diff");
      await option.bufhidden.setLocal(denops, "unload");
      await option.buftype.setLocal(denops, "nofile");
      await option.swapfile.setLocal(denops, false);
      await option.modifiable.setLocal(denops, false);
      await mapping.map(
        denops,
        "<Plug>(gin-diffjump-old)",
        `<Cmd>call denops#request('gin', 'diff:jump:old', [])<CR>`,
        {
          buffer: true,
          noremap: true,
        },
      );
      await mapping.map(
        denops,
        "<Plug>(gin-diffjump-new)",
        `<Cmd>call denops#request('gin', 'diff:jump:new', [])<CR>`,
        {
          buffer: true,
          noremap: true,
        },
      );
      if (!disableDefaultMappings) {
        await mapping.map(
          denops,
          "g<CR>",
          "<Plug>(gin-diffjump-old)zv",
          {
            buffer: true,
          },
        );
        await mapping.map(
          denops,
          "<CR>",
          "<Plug>(gin-diffjump-new)zv",
          {
            buffer: true,
          },
        );
      }
    });
  });
  await buffer.assign(denops, bufnr, stdout, {
    fileformat: opts["ff"] ?? opts["fileformat"],
    fileencoding: opts["enc"] ?? opts["fileencoding"],
  });
  await buffer.concrete(denops, bufnr);
}

function parseResidue(residue: string[]): [string | undefined, string] {
  // GinDiff [{options}] [{commitish}] {path}
  switch (residue.length) {
    case 1:
      return [undefined, residue[0].toString()];
    case 2:
      return [residue[0].toString(), residue[1].toString()];
    default:
      throw new Error("Invalid number of arguments");
  }
}

export async function jumpOld(denops: Denops): Promise<void> {
  const [lnum, content, bname] = await batch.gather(
    denops,
    async (denops) => {
      await fn.line(denops, ".");
      await fn.getline(denops, 1, "$");
      await fn.bufname(denops, "%");
    },
  );
  unknownutil.assertNumber(lnum);
  unknownutil.assertArray(content, unknownutil.isString);
  unknownutil.assertString(bname);
  const { expr, params } = bufname.parse(bname);
  const jump = findJumpOld(lnum - 1, content);
  if (!jump) {
    // Do nothing
    return;
  }
  const filename = path.join(expr, jump.path.replace(/^a\//, ""));
  const cached = "cached" in (params ?? {});
  const commitish = unknownutil.ensureString(params?.commitish ?? "");
  const [target, _] = parseCommitish(commitish, cached);
  if (target === INDEX) {
    await editCommand(denops, [
      `++worktree=${expr}`,
      "--cached",
      filename,
    ]);
  } else if (target === WORKTREE) {
    await editCommand(denops, [
      `++worktree=${expr}`,
      filename,
    ]);
  } else {
    await editCommand(denops, [
      `++worktree=${expr}`,
      commitish || "HEAD",
      filename,
    ]);
  }
  await fn.cursor(denops, jump.lnum, 1);
}

export async function jumpNew(denops: Denops): Promise<void> {
  const [lnum, content, bname] = await batch.gather(
    denops,
    async (denops) => {
      await fn.line(denops, ".");
      await fn.getline(denops, 1, "$");
      await fn.bufname(denops, "%");
    },
  );
  unknownutil.assertNumber(lnum);
  unknownutil.assertArray(content, unknownutil.isString);
  unknownutil.assertString(bname);
  const { expr, params } = bufname.parse(bname);
  const jump = findJumpNew(lnum - 1, content);
  if (!jump) {
    // Do nothing
    return;
  }
  const filename = path.join(expr, jump.path.replace(/^b\//, ""));
  const cached = "cached" in (params ?? {});
  const commitish = unknownutil.ensureString(params?.commitish ?? "");
  const [_, target] = parseCommitish(commitish, cached);
  if (target === INDEX) {
    await editCommand(denops, [
      `++worktree=${expr}`,
      "--cached",
      filename,
    ]);
  } else if (target === WORKTREE) {
    await editCommand(denops, [
      `++worktree=${expr}`,
      filename,
    ]);
  } else {
    await editCommand(denops, [
      `++worktree=${expr}`,
      commitish || "HEAD",
      filename,
    ]);
  }
  await fn.cursor(denops, jump.lnum, 1);
}
