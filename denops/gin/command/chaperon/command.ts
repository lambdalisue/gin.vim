import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as mapping from "https://deno.land/x/denops_std@v6.4.0/mapping/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.4.0/option/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import { findWorktreeFromDenops } from "../../git/worktree.ts";
import { exec as execEdit } from "../edit/command.ts";
import { AliasHead, getInProgressAliasHead, stripConflicts } from "./util.ts";

export type ExecOptions = {
  worktree?: string;
  noOurs?: boolean;
  noTheirs?: boolean;
  opener?: string;
  cmdarg?: string;
  mods?: string;
  bang?: boolean;
};

export async function exec(
  denops: Denops,
  filename: string,
  options: ExecOptions = {},
): Promise<void> {
  const [verbose, noSupplements, supplementHeight, disableDefaultMappings] =
    await batch
      .collect(
        denops,
        (denops) => [
          option.verbose.get(denops),
          vars.g.get(denops, "gin_chaperon_supplement_disable", 0),
          vars.g.get(denops, "gin_chaperon_supplement_height", 10),
          vars.g.get(
            denops,
            "gin_chaperon_disable_default_mappings",
            false,
          ),
        ],
      );
  assert(noSupplements, is.Number, {
    name: "g:gin_chaperon_supplement_disable",
  });
  assert(supplementHeight, is.Number, {
    name: "g:gin_chaperon_supplement_height",
  });
  assert(disableDefaultMappings, is.Boolean, {
    name: "g:gin_chaperon_disable_default_mappings",
  });

  const worktree = await findWorktreeFromDenops(denops, {
    worktree: options.worktree,
    verbose: !!verbose,
  });
  const abspath = path.isAbsolute(filename)
    ? filename
    : path.join(worktree, filename);

  const inProgressAliasHead = await getInProgressAliasHead(worktree);

  const infoWorktree = await buffer.open(denops, abspath, {
    opener: options.opener,
    cmdarg: options.cmdarg,
    mods: options.mods,
    bang: options.bang,
  });

  let infoTheirs: buffer.OpenResult | undefined;
  if (!options.noTheirs) {
    infoTheirs = await execEdit(denops, abspath, {
      worktree,
      commitish: ":3",
      opener: "topleft vsplit",
      cmdarg: options.cmdarg,
      mods: options.mods,
    });
    await fn.win_gotoid(denops, infoWorktree.winid);
  }

  let infoOurs: buffer.OpenResult | undefined;
  if (!options.noOurs) {
    infoOurs = await execEdit(denops, abspath, {
      worktree,
      commitish: ":2",
      opener: "botright vsplit",
      cmdarg: options.cmdarg,
      mods: options.mods,
    });
  }

  // Theirs
  if (infoTheirs) {
    await initTheirs(
      denops,
      infoTheirs.bufnr,
      infoWorktree.bufnr,
      disableDefaultMappings,
    );
  }

  // WORKTREE
  await initWorktree(
    denops,
    infoWorktree.bufnr,
    infoTheirs?.bufnr,
    infoOurs?.bufnr,
    disableDefaultMappings,
  );

  // Ours
  if (infoOurs) {
    await initOurs(
      denops,
      infoOurs.bufnr,
      infoWorktree.bufnr,
      disableDefaultMappings,
    );
  }

  // Supplements
  if (!noSupplements) {
    await openSupplements(
      denops,
      infoTheirs?.winid,
      infoWorktree.winid,
      infoOurs?.winid,
      supplementHeight,
      inProgressAliasHead,
    );
  }

  // edit | diffthis
  const winids = [infoWorktree, infoTheirs, infoOurs]
    .map((v) => v?.winid)
    .filter((v) => v) as number[];
  await batch.batch(denops, async (denops) => {
    for (const winid of winids) {
      await fn.win_execute(denops, winid, "diffthis", "silent!");
    }
  });

  // Focus Worktree
  await fn.win_gotoid(denops, infoWorktree.winid);
}

async function initTheirs(
  denops: Denops,
  bufnr: number,
  bufnrWorktree: number,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      const modes: mapping.Mode[] = ["n", "x"];
      await mapping.map(
        denops,
        "<Plug>(gin-diffput)",
        `<Cmd>diffput ${bufnrWorktree}<CR><Cmd>diffupdate<CR>`,
        {
          buffer: true,
          noremap: true,
          mode: modes,
        },
      );
      if (!disableDefaultMappings) {
        await mapping.map(
          denops,
          "dp",
          "<Plug>(gin-diffput)",
          {
            buffer: true,
            mode: modes,
          },
        );
      }
      await denops.cmd("silent! edit");
    });
  });
}

async function initWorktree(
  denops: Denops,
  bufnr: number,
  bufnrTheirs: number | undefined,
  bufnrOurs: number | undefined,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    const content = await fn.getbufline(denops, bufnr, 1, "$");
    await buffer.replace(denops, bufnr, stripConflicts(content));
    await batch.batch(denops, async (denops) => {
      const modes: mapping.Mode[] = ["n", "x"];
      if (bufnrTheirs) {
        await mapping.map(
          denops,
          "<Plug>(gin-diffget-l)",
          `<Cmd>diffget ${bufnrTheirs}<CR><Cmd>diffupdate<CR>`,
          {
            buffer: true,
            noremap: true,
            mode: modes,
          },
        );
        await mapping.map(
          denops,
          "<Plug>(gin-diffget)",
          "<Plug>(gin-diffget-l)",
          {
            buffer: true,
            mode: modes,
          },
        );
        if (!disableDefaultMappings) {
          await mapping.map(
            denops,
            "dol",
            "<Plug>(gin-diffget-l)",
            {
              buffer: true,
              mode: modes,
            },
          );
          await mapping.map(
            denops,
            "do",
            "<Plug>(gin-diffget)",
            {
              buffer: true,
              mode: modes,
            },
          );
        }
      }
      if (bufnrOurs) {
        await mapping.map(
          denops,
          "<Plug>(gin-diffget-r)",
          `<Cmd>diffget ${bufnrOurs}<CR><Cmd>diffupdate<CR>`,
          {
            buffer: true,
            noremap: true,
            mode: modes,
          },
        );
        await mapping.map(
          denops,
          "<Plug>(gin-diffget)",
          "<Plug>(gin-diffget-r)",
          {
            buffer: true,
            mode: modes,
          },
        );
        if (!disableDefaultMappings) {
          await mapping.map(
            denops,
            "dor",
            "<Plug>(gin-diffget-r)",
            {
              buffer: true,
              mode: modes,
            },
          );
          await mapping.map(
            denops,
            "do",
            "<Plug>(gin-diffget)",
            {
              buffer: true,
              mode: modes,
            },
          );
        }
      }
    });
  });
}

async function initOurs(
  denops: Denops,
  bufnr: number,
  bufnrWorktree: number,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      const modes: mapping.Mode[] = ["n", "x"];
      await mapping.map(
        denops,
        "<Plug>(gin-diffput)",
        `<Cmd>diffput ${bufnrWorktree}<CR><Cmd>diffupdate<CR>`,
        {
          buffer: true,
          noremap: true,
          mode: modes,
        },
      );
      if (!disableDefaultMappings) {
        await mapping.map(
          denops,
          "dp",
          "<Plug>(gin-diffput)",
          {
            buffer: true,
            mode: modes,
          },
        );
      }
      await denops.cmd("silent! edit");
    });
  });
}

async function openSupplements(
  denops: Denops,
  winidTheirs: number | undefined,
  winidWorktree: number,
  winidOurs: number | undefined,
  supplementHeight: number,
  inProgressAliasHead: AliasHead | undefined,
) {
  if (winidTheirs && await fn.winbufnr(denops, winidTheirs) !== -1) {
    await batch.batch(denops, async (denops) => {
      await fn.win_gotoid(denops, winidTheirs);
      await denops.cmd(`rightbelow ${supplementHeight}split`);
      await denops.cmd(
        `silent! GinBuffer log -1 ${inProgressAliasHead} -p`,
      );
      await option.winfixheight.setLocal(denops, true);
      await option.filetype.setLocal(denops, "git");
    });
  }

  await batch.batch(denops, async (denops) => {
    await fn.win_gotoid(denops, winidWorktree);
    await denops.cmd(`rightbelow ${supplementHeight}split`);
    await denops.cmd(
      `silent! GinBuffer log --oneline --left-right ${inProgressAliasHead}...HEAD`,
    );
    await option.winfixheight.setLocal(denops, true);
    await option.filetype.setLocal(denops, "diff");
  });

  if (winidOurs) {
    await batch.batch(denops, async (denops) => {
      await fn.win_gotoid(denops, winidOurs);
      await denops.cmd(`rightbelow ${supplementHeight}split`);
      await denops.cmd("silent! GinBuffer log -1 HEAD -p");
      await option.winfixheight.setLocal(denops, true);
      await option.filetype.setLocal(denops, "git");
    });
  }
}
