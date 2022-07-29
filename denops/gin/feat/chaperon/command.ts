import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.5.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.5.0/function/mod.ts";
import * as mapping from "https://deno.land/x/denops_std@v3.5.0/mapping/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.5.0/variable/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as path from "https://deno.land/std@0.150.0/path/mod.ts";
import {
  builtinOpts,
  formatOpts,
  parse,
  validateOpts,
} from "https://deno.land/x/denops_std@v3.5.0/argument/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v3.5.0/buffer/mod.ts";
import { normCmdArgs } from "../../util/cmd.ts";
import { getWorktreeFromOpts } from "../../util/worktree.ts";
import { command as editCommand } from "../edit/command.ts";
import { AliasHead, getInProgressAliasHead, stripConflicts } from "./util.ts";

export async function command(
  denops: Denops,
  args: string[],
): Promise<void> {
  const [opts, _, residue] = parse(await normCmdArgs(denops, args));
  validateOpts(opts, [
    "worktree",
    "no-ours",
    "no-theirs",
    ...builtinOpts,
  ]);
  const noOurs = "no-ours" in opts;
  const noTheirs = "no-theirs" in opts;
  const [abspath] = parseResidue(residue);
  const worktree = await getWorktreeFromOpts(denops, opts);
  const relpath = path.relative(worktree, abspath);
  const leading = formatOpts(opts, builtinOpts);

  const [noSupplements, supplementHeight, disableDefaultMappings] = await batch
    .gather(
      denops,
      async (denops) => {
        await vars.g.get(denops, "gin_chaperon_supplement_disable", 0);
        await vars.g.get(denops, "gin_chaperon_supplement_height", 10);
        await vars.g.get(
          denops,
          "gin_chaperon_disable_default_mappings",
          false,
        );
      },
    );
  unknownutil.assertNumber(noSupplements);
  unknownutil.assertNumber(supplementHeight);
  unknownutil.assertBoolean(disableDefaultMappings);

  const inProgressAliasHead = await getInProgressAliasHead(worktree);

  let bufnrTheirs = -1;
  if (!noTheirs) {
    await editCommand(denops, [
      ...leading,
      `++worktree=${worktree}`,
      ":3",
      relpath,
    ]);
    bufnrTheirs = await fn.bufnr(denops);
    await denops.cmd("botright vsplit");
  }

  await editCommand(denops, [
    ...leading,
    `++worktree=${worktree}`,
    relpath,
  ]);
  const bufnrWorktree = await fn.bufnr(denops);

  let bufnrOurs = -1;
  if (!noOurs) {
    await denops.cmd("botright vsplit");
    await editCommand(denops, [
      ...leading,
      `++worktree=${worktree}`,
      ":2",
      relpath,
    ]);
    bufnrOurs = await fn.bufnr(denops);
  }

  // Theirs
  if (bufnrTheirs !== -1) {
    await initTheirs(
      denops,
      bufnrTheirs,
      bufnrWorktree,
      noSupplements ? 0 : supplementHeight,
      inProgressAliasHead,
      disableDefaultMappings,
    );
  }

  // WORKTREE
  await initWorktree(
    denops,
    bufnrWorktree,
    bufnrTheirs,
    bufnrOurs,
    noSupplements ? 0 : supplementHeight,
    inProgressAliasHead,
    disableDefaultMappings,
  );

  // Ours
  if (bufnrOurs !== -1) {
    await initOurs(
      denops,
      bufnrOurs,
      bufnrWorktree,
      noSupplements ? 0 : supplementHeight,
      disableDefaultMappings,
    );
  }

  // Focus Worktree
  const winid = await fn.bufwinid(denops, bufnrWorktree);
  await fn.win_gotoid(denops, winid);
}

function parseResidue(
  residue: string[],
): [string] {
  // GinChaperon [{options}] {path}
  switch (residue.length) {
    case 1:
      return [residue[0]];
    default:
      throw new Error("Invalid number of arguments");
  }
}

async function initTheirs(
  denops: Denops,
  bufnr: number,
  bufnrWorktree: number,
  supplementHeight: number,
  inProgressAliasHead: AliasHead | undefined,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await mapping.map(
        denops,
        "<Plug>(gin-diffput)",
        `<Cmd>diffput ${bufnrWorktree}<CR><Cmd>diffupdate<CR>`,
        {
          buffer: true,
          noremap: true,
        },
      );
      if (!disableDefaultMappings) {
        await mapping.map(
          denops,
          "dp",
          "<Plug>(gin-diffput)",
          {
            buffer: true,
          },
        );
      }
      await denops.cmd("diffthis");
    });
    if (supplementHeight) {
      await denops.cmd(
        `leftabove ${supplementHeight}split | setlocal winfixheight | Gin! ++buffer log -1 ${inProgressAliasHead} -p | set filetype=git`,
      );
    }
  });
}

async function initOurs(
  denops: Denops,
  bufnr: number,
  bufnrWorktree: number,
  supplementHeight: number,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      await mapping.map(
        denops,
        "<Plug>(gin-diffput)",
        `<Cmd>diffput ${bufnrWorktree}<CR><Cmd>diffupdate<CR>`,
        {
          buffer: true,
          noremap: true,
        },
      );
      if (!disableDefaultMappings) {
        await mapping.map(
          denops,
          "dp",
          "<Plug>(gin-diffput)",
          {
            buffer: true,
          },
        );
      }
      await denops.cmd("diffthis");
    });
    if (supplementHeight) {
      await denops.cmd(
        `leftabove ${supplementHeight}split | setlocal winfixheight | Gin! ++buffer log -1 HEAD -p | set filetype=git`,
      );
    }
  });
}

async function initWorktree(
  denops: Denops,
  bufnr: number,
  bufnrTheirs: number,
  bufnrOurs: number,
  supplementHeight: number,
  inProgressAliasHead: string | undefined,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    const content = await fn.getbufline(denops, bufnr, 1, "$");
    await buffer.replace(denops, bufnr, stripConflicts(content));
    await batch.batch(denops, async (denops) => {
      if (bufnrTheirs !== -1) {
        await mapping.map(
          denops,
          "<Plug>(gin-diffget-l)",
          `<Cmd>diffget ${bufnrTheirs}<CR><Cmd>diffupdate<CR>`,
          {
            buffer: true,
            noremap: true,
          },
        );
        await mapping.map(
          denops,
          "<Plug>(gin-diffget)",
          "<Plug>(gin-diffget-l)",
          {
            buffer: true,
          },
        );
        if (!disableDefaultMappings) {
          await mapping.map(
            denops,
            "dol",
            "<Plug>(gin-diffget-l)",
            {
              buffer: true,
            },
          );
          await mapping.map(
            denops,
            "do",
            "<Plug>(gin-diffget)",
            {
              buffer: true,
            },
          );
        }
      }
      if (bufnrOurs !== -1) {
        await mapping.map(
          denops,
          "<Plug>(gin-diffget-r)",
          `<Cmd>diffget ${bufnrOurs}<CR><Cmd>diffupdate<CR>`,
          {
            buffer: true,
            noremap: true,
          },
        );
        await mapping.map(
          denops,
          "<Plug>(gin-diffget)",
          "<Plug>(gin-diffget-r)",
          {
            buffer: true,
          },
        );
        if (!disableDefaultMappings) {
          await mapping.map(
            denops,
            "dor",
            "<Plug>(gin-diffget-r)",
            {
              buffer: true,
            },
          );
          await mapping.map(
            denops,
            "do",
            "<Plug>(gin-diffget)",
            {
              buffer: true,
            },
          );
        }
      }
      await denops.cmd("diffthis");
    });
    if (supplementHeight) {
      await denops.cmd(
        `leftabove ${supplementHeight}split | setlocal winfixheight | Gin! ++buffer log --oneline --left-right ${inProgressAliasHead}...HEAD | set filetype=diff`,
      );
    }
  });
}
