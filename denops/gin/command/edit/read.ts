import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import { unnullish } from "https://deno.land/x/unnullish@v1.0.1/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import {
  parseOpts,
  validateOpts,
} from "https://deno.land/x/denops_std@v6.4.0/argument/mod.ts";
import { parse as parseBufname } from "https://deno.land/x/denops_std@v6.4.0/bufname/mod.ts";
import { execute } from "../../git/executor.ts";
import { formatTreeish } from "./util.ts";

export async function read(
  denops: Denops,
  bufnr: number,
  bufname: string,
): Promise<void> {
  const cmdarg = ensure(await vars.v.get(denops, "cmdarg"), is.String);
  const [opts, _] = parseOpts(cmdarg.split(" "));
  validateOpts(opts, ["enc", "encoding", "ff", "fileformat"]);
  const { scheme, expr, params, fragment } = parseBufname(bufname);
  if (!fragment) {
    throw new Error(`A buffer '${scheme}://' requires a fragment part`);
  }
  await exec(denops, bufnr, fragment, {
    worktree: expr,
    commitish: unnullish(
      params?.commitish,
      (v) => ensure(v, is.String, { message: "commitish must be string" }),
    ),
    encoding: opts.enc ?? opts.encoding,
    fileformat: opts.ff ?? opts.fileformat,
  });
}

export type ExecOptions = {
  worktree?: string;
  commitish?: string;
  lnum?: number;
  encoding?: string;
  fileformat?: string;
};

export async function exec(
  denops: Denops,
  bufnr: number,
  relpath: string,
  options: ExecOptions,
): Promise<void> {
  const filename = relpath.replaceAll("\\", "/");
  const args = ["show", ...formatTreeish(options.commitish, filename)];
  const { stdout } = await execute(
    denops,
    args,
    {
      worktree: options.worktree,
      throwOnError: true,
      stdoutIndicator: "null",
    },
  );
  const { content } = await buffer.decode(denops, bufnr, stdout, {
    fileformat: options.fileformat,
    fileencoding: options.encoding,
  });
  await buffer.append(denops, bufnr, content, {
    lnum: options.lnum,
  });
}
