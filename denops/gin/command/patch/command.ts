import type { Denops } from "https://deno.land/x/denops_std@v6.0.1/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.0.1/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.0.1/function/mod.ts";
import * as mapping from "https://deno.land/x/denops_std@v6.0.1/mapping/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v6.0.1/variable/mod.ts";
import * as option from "https://deno.land/x/denops_std@v6.0.1/option/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.0.1/buffer/mod.ts";
import { findWorktreeFromDenops } from "../../git/worktree.ts";
import { exec as execEdit } from "../edit/command.ts";

export type ExecOptions = {
  worktree?: string;
  noHead?: boolean;
  noWorktree?: boolean;
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
  const [verbose, disableDefaultMappings] = await batch.collect(
    denops,
    (denops) => [
      option.verbose.get(denops),
      vars.g.get(
        denops,
        "gin_patch_disable_default_mappings",
        false,
      ),
    ],
  );
  assert(disableDefaultMappings, is.Boolean, {
    name: "g:gin_patch_disable_default_mappings",
  });

  const worktree = await findWorktreeFromDenops(denops, {
    worktree: options.worktree,
    verbose: !!verbose,
  });
  const abspath = path.isAbsolute(filename)
    ? filename
    : path.join(worktree, filename);

  const infoIndex = await execEdit(denops, abspath, {
    worktree,
    opener: options.opener,
    cmdarg: options.cmdarg,
    mods: options.mods,
    bang: options.bang,
  });

  let infoHead: buffer.OpenResult | undefined;
  if (!options.noHead) {
    infoHead = await execEdit(denops, abspath, {
      worktree,
      commitish: "HEAD",
      opener: "topleft vsplit",
      cmdarg: options.cmdarg,
      mods: options.mods,
    });
    await fn.win_gotoid(denops, infoIndex.winid);
  }

  let infoWorktree: buffer.OpenResult | undefined;
  if (!options.noWorktree) {
    infoWorktree = await buffer.open(denops, abspath, {
      opener: "botright vsplit",
      cmdarg: options.cmdarg,
      mods: options.mods,
    });
  }

  // HEAD
  if (infoHead) {
    await initHead(
      denops,
      infoHead.bufnr,
      infoIndex.bufnr,
      disableDefaultMappings,
    );
  }

  // INDEX
  await initIndex(
    denops,
    infoIndex.bufnr,
    infoHead?.bufnr,
    infoWorktree?.bufnr,
    disableDefaultMappings,
  );

  // WORKTREE
  if (infoWorktree) {
    await initWorktree(
      denops,
      infoWorktree.bufnr,
      infoIndex.bufnr,
      disableDefaultMappings,
    );
  }

  // edit | diffthis
  const winids = [infoIndex, infoHead, infoWorktree]
    .map((v) => v?.winid)
    .filter((v) => v) as number[];
  await batch.batch(denops, async (denops) => {
    for (const winid of winids) {
      await fn.win_execute(denops, winid, "diffthis", "silent!");
    }
  });

  // Focus INDEX
  await fn.win_gotoid(denops, infoIndex.winid);
}

async function initHead(
  denops: Denops,
  bufnr: number,
  bufnrIndex: number,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      const modes: mapping.Mode[] = ["n", "x"];
      await mapping.map(
        denops,
        "<Plug>(gin-diffput)",
        `<Cmd>diffput ${bufnrIndex}<CR><Cmd>diffupdate<CR>`,
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
  bufnrIndex: number,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      const modes: mapping.Mode[] = ["n", "x"];
      await mapping.map(
        denops,
        "<Plug>(gin-diffput)",
        `<Cmd>diffput ${bufnrIndex}<CR><Cmd>diffupdate<CR>`,
        {
          buffer: true,
          noremap: true,
          mode: modes,
        },
      );
      await mapping.map(
        denops,
        "<Plug>(gin-diffget)",
        `<Cmd>diffget ${bufnrIndex}<CR><Cmd>diffupdate<CR>`,
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
      await denops.cmd("silent! edit");
    });
  });
}

async function initIndex(
  denops: Denops,
  bufnr: number,
  bufnrHead: number | undefined,
  bufnrWorktree: number | undefined,
  disableDefaultMappings: boolean,
): Promise<void> {
  await buffer.ensure(denops, bufnr, async () => {
    await batch.batch(denops, async (denops) => {
      const modes: mapping.Mode[] = ["n", "x"];
      if (bufnrHead !== -1) {
        await mapping.map(
          denops,
          "<Plug>(gin-diffget-l)",
          `<Cmd>diffget ${bufnrHead}<CR><Cmd>diffupdate<CR>`,
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
      if (bufnrWorktree !== -1) {
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
        await mapping.map(
          denops,
          "<Plug>(gin-diffget-r)",
          `<Cmd>diffget ${bufnrWorktree}<CR><Cmd>diffupdate<CR>`,
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
            "dp",
            "<Plug>(gin-diffput)",
            {
              buffer: true,
              mode: modes,
            },
          );
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
      await denops.cmd("silent! edit");
    });
  });
}
