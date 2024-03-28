import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { unnullish } from "https://deno.land/x/unnullish@v1.0.1/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as mapping from "https://deno.land/x/denops_std@v6.4.0/mapping/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import {
  parse as parseBufname,
} from "https://deno.land/x/denops_std@v6.4.0/bufname/mod.ts";
import {
  builtinOpts,
  Flags,
  formatFlags,
  parseOpts,
  validateOpts,
} from "https://deno.land/x/denops_std@v6.4.0/argument/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import { exec as execBuffer } from "../../command/buffer/edit.ts";

export async function edit(
  denops: Denops,
  bufnr: number,
  bufname: string,
): Promise<void> {
  const cmdarg = await vars.v.get(denops, "cmdarg") as string;
  const [opts, _] = parseOpts(cmdarg.split(" "));
  validateOpts(opts, builtinOpts);
  const { expr, params, fragment } = parseBufname(bufname);
  await exec(denops, bufnr, {
    processor: unnullish(
      params?.processor,
      (v) =>
        ensure(v, is.String, { message: "processor must be string" }).split(
          " ",
        ),
    ),
    worktree: expr,
    commitish: unnullish(
      params?.commitish,
      (v) => ensure(v, is.String, { message: "commitish must be string" }),
    ),
    paths: unnullish(fragment, JSON.parse),
    flags: {
      ...params,
      processor: undefined,
      commitish: undefined,
    },
    encoding: opts.enc ?? opts.encoding,
    fileformat: opts.ff ?? opts.fileformat,
  });
}

export type ExecOptions = {
  processor?: string[];
  worktree?: string;
  commitish?: string;
  paths?: string[];
  flags?: Flags;
  encoding?: string;
  fileformat?: string;
};

export async function exec(
  denops: Denops,
  bufnr: number,
  options: ExecOptions,
): Promise<void> {
  const filenames = options.paths?.map((v) => v.replaceAll("\\", "/"));
  const args = [
    "diff",
    ...formatFlags(options.flags ?? {}),
    ...(unnullish(options.commitish, (v) => [v]) ?? []),
    "--",
    ...(filenames ?? []),
  ];
  await execBuffer(denops, bufnr, args, {
    processor: options.processor,
    worktree: options.worktree,
    encoding: options.encoding,
    fileformat: options.fileformat,
  });
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await option.filetype.setLocal(denops, "gin-diff");
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
      await mapping.map(
        denops,
        "<Plug>(gin-diffjump-smart)",
        `<Cmd>call denops#request('gin', 'diff:jump:smart', [])<CR>`,
        {
          buffer: true,
          noremap: true,
        },
      );
    });
  });
}
