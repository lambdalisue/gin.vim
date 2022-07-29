import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.5.0/autocmd/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.5.0/batch/mod.ts";
import * as bufname from "https://deno.land/x/denops_std@v3.5.0/bufname/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.5.0/function/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v3.5.0/helper/mod.ts";
import * as option from "https://deno.land/x/denops_std@v3.5.0/option/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.5.0/variable/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as fs from "https://deno.land/std@0.150.0/fs/mod.ts";
import * as path from "https://deno.land/std@0.150.0/path/mod.ts";
import {
  builtinOpts,
  formatOpts,
  parse,
  parseOpts,
  validateFlags,
  validateOpts,
} from "https://deno.land/x/denops_std@v3.5.0/argument/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v3.5.0/buffer/mod.ts";
import { normCmdArgs } from "../../util/cmd.ts";
import { getWorktreeFromOpts } from "../../util/worktree.ts";
import { decodeUtf8 } from "../../util/text.ts";
import { run } from "../../git/process.ts";
import { command as bareCommand } from "../../core/bare/command.ts";

export async function command(
  denops: Denops,
  args: string[],
): Promise<void> {
  const [opts, flags, residue] = parse(await normCmdArgs(denops, args));
  validateOpts(opts, [
    "worktree",
    ...builtinOpts,
  ]);
  validateFlags(flags, [
    "cached",
  ]);
  const [commitish, abspath] = parseResidue(residue);
  const worktree = await getWorktreeFromOpts(denops, opts);
  const relpath = path.relative(worktree, abspath);
  const cmdarg = formatOpts(opts, builtinOpts).join(" ");

  if (!commitish && flags.cached == null) {
    // worktree
    await buffer.open(denops, path.join(worktree, relpath), { cmdarg });
  } else {
    // commitish/cached
    const bname = bufname.format({
      scheme: "ginedit",
      expr: worktree,
      params: {
        ...flags,
        cached: undefined,
        commitish,
      },
      fragment: relpath,
    });
    await buffer.open(denops, bname.toString(), { cmdarg });
  }
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
    );
  unknownutil.assertObject(env, unknownutil.isString);
  unknownutil.assertNumber(verbose);
  unknownutil.assertNumber(bufnr);
  unknownutil.assertString(bname);
  unknownutil.assertString(cmdarg);
  unknownutil.assertBoolean(disableDefaultMappings);
  const [opts, _] = parseOpts(cmdarg.split(" "));
  validateOpts(opts, builtinOpts);
  const { expr, params, fragment } = bufname.parse(bname);
  if (!fragment) {
    throw new Error("A buffer 'ginedit://' requires a fragment part");
  }
  const args = [
    "show",
    ...formatTreeish(params?.commitish, fragment),
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
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await denops.cmd("filetype detect");
      await option.swapfile.setLocal(denops, false);
      await option.bufhidden.setLocal(denops, "unload");
      if (params?.commitish) {
        await option.buftype.setLocal(denops, "nowrite");
      } else {
        await option.buftype.setLocal(denops, "acwrite");
        await autocmd.group(denops, "gitedit_read_internal", (helper) => {
          helper.remove("*", "<buffer>");
          helper.define(
            "BufWriteCmd",
            "<buffer>",
            `call denops#request('gin', 'edit:write', [])`,
            {
              nested: true,
            },
          );
        });
      }
    });
  });
  await buffer.assign(denops, bufnr, stdout, {
    fileformat: opts["ff"] ?? opts["fileformat"],
    fileencoding: opts["enc"] ?? opts["fileencoding"],
  });
  await buffer.concrete(denops, bufnr);
  if (!status.success) {
    await helper.echoerr(denops, decodeUtf8(stderr));
  }
}

export async function write(denops: Denops): Promise<void> {
  const [bufnr, bname, content] = await batch.gather(
    denops,
    async (denops) => {
      await fn.bufnr(denops);
      await fn.bufname(denops);
      await fn.getline(denops, 1, "$");
    },
  );
  unknownutil.assertNumber(bufnr);
  unknownutil.assertString(bname);
  unknownutil.assertArray(content, unknownutil.isString);
  const { expr, fragment } = bufname.parse(bname);
  if (!fragment) {
    throw new Error("A buffer 'ginedit://' requires a fragment part");
  }
  const original = path.join(expr, fragment);
  let restore: () => Promise<void>;
  const f = await Deno.makeTempFile({
    dir: path.dirname(original),
  });
  try {
    await Deno.rename(original, f);
    restore = () => Deno.rename(f, original);
  } catch (e) {
    if (!(e instanceof Deno.errors.NotFound)) {
      throw e;
    }
    await Deno.remove(f);
    restore = () => Deno.remove(original);
  }
  try {
    await fs.ensureFile(original);
    await Deno.writeTextFile(original, `${content.join("\n")}\n`);
    await bareCommand(denops, [
      `++worktree=${expr}`,
      "add",
      "--force",
      "--",
      fragment,
    ]);
    await fn.setbufvar(denops, bufnr, "&modified", 0);
    await helper.echo(denops, `[gin] INDEX of '${fragment}' is updated.`);
  } finally {
    await restore();
  }
}

function parseResidue(
  residue: string[],
): [string | undefined, string] {
  // GinEdit [{options}] {path}
  // GinEdit [{options}] --cached {path}
  // GinEdit [{options}] {commitish} {path}
  switch (residue.length) {
    case 1:
      return [undefined, residue[0].toString()];
    case 2:
      return [residue[0].toString(), residue[1].toString()];
    default:
      throw new Error("Invalid number of arguments");
  }
}

function formatTreeish(
  commitish: string | string[] | undefined,
  relpath: string,
): [] | [string] {
  if (commitish) {
    unknownutil.assertString(commitish);
    return [`${commitish}:${relpath}`];
  } else {
    return [`:${relpath}`];
  }
}
