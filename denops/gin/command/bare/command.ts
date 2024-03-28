import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v6.4.0/autocmd/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v6.4.0/helper/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import { removeAnsiEscapeCode } from "../../util/ansi_escape_code.ts";
import { execute } from "../../git/executor.ts";

export type ExecOptions = {
  worktree?: string;
  encoding?: string;
  fileformat?: string;
  stdoutIndicator?: string;
  stderrIndicator?: string;
};

export async function exec(
  denops: Denops,
  args: string[],
  options: ExecOptions = {},
): Promise<void> {
  const eventignore = await option.eventignore.get(denops);
  const { stdout, stderr } = await execute(denops, args, {
    worktree: options.worktree,
    throwOnError: true,
    stdoutIndicator: options.stdoutIndicator,
    stderrIndicator: options.stderrIndicator,
  });
  const encoding = options.encoding ?? "utf8";
  const decoder = new TextDecoder(encoding);
  const text = decoder.decode(new Uint8Array([...stdout, ...stderr]));
  const content = text.split(
    getSeparator(options.fileformat),
  );
  await helper.echo(
    denops,
    removeAnsiEscapeCode(content.join("\n")),
  );
  if (!eventignore.includes("all")) {
    await denops.call(
      "gin#internal#util#debounce",
      "doautocmd <nomodeline> User GinCommandPost",
      100,
    );
  }
}

function getSeparator(fileformat: string | undefined): RegExp {
  switch (fileformat) {
    case "dos":
      return /\r\n/g;
    case "unix":
      return /\n/g;
    case "mac":
      return /\r/g;
    default:
      return /\r?\n/g;
  }
}

export async function bind(denops: Denops, bufnr: number): Promise<void> {
  await autocmd.group(
    denops,
    `gin_core_echo_command_bind_${bufnr}`,
    (helper) => {
      helper.remove();
      helper.define(
        "User",
        "GinCommandPost",
        `call gin#util#reload(${bufnr})`,
      );
    },
  );
}
