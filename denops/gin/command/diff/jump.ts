import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.17.0/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import {
  parse as parseBufname,
} from "https://deno.land/x/denops_std@v6.4.0/bufname/mod.ts";
import { exec as execEdit } from "../edit/command.ts";
import { Commitish, INDEX, parseCommitish, WORKTREE } from "./commitish.ts";

const patternSpc = /^(?:@@|\-\-\-|\+\+\+) /;
const patternRng = /^@@ \-(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@.*$/;
const patternOld = /^\-\-\- (.*?)(?:\t.*)?$/;
const patternNew = /^\+\+\+ (.*?)(?:\t.*)?$/;

type Finder = (index: number, content: string[]) => Jump | undefined;

type Parser = (commitish: string, cached: boolean) => Commitish;

export type Jump = {
  path: string;
  lnum: number;
};

export function findJumpOld(
  index: number,
  content: string[],
): Jump | undefined {
  if (patternSpc.test(content[index])) {
    // We cannot find jump for special lines
    return undefined;
  }
  let path = "";
  let lnum = -1;
  let offset = 0;
  for (let i = index; i >= 0; i--) {
    const line = content[i];
    if (lnum === -1) {
      const m1 = line.match(patternRng);
      if (m1) {
        lnum = Number(m1[1]);
        continue;
      }
      if (!line.startsWith("+")) {
        offset += 1;
      }
    }
    const m2 = line.match(patternOld);
    if (m2) {
      path = m2[1];
      break;
    }
  }
  if (lnum === -1) {
    throw new Error(`No range pattern found in ${content}`);
  }
  if (path === "") {
    throw new Error(`No old pattern found in ${content}`);
  }
  lnum += offset - 1;
  return {
    path,
    lnum,
  };
}

export function findJumpNew(
  index: number,
  content: string[],
): Jump | undefined {
  if (patternSpc.test(content[index])) {
    // We cannot find jump for special lines
    return undefined;
  }
  let path = "";
  let lnum = -1;
  let offset = 0;
  for (let i = index; i >= 0; i--) {
    const line = content[i];
    if (lnum === -1) {
      const m1 = line.match(patternRng);
      if (m1) {
        lnum = Number(m1[2]);
        continue;
      }
      if (!line.startsWith("-")) {
        offset += 1;
      }
    }
    const m2 = line.match(patternNew);
    if (m2) {
      path = m2[1];
      break;
    }
  }
  if (lnum === -1) {
    throw new Error(`No range pattern found in ${content}`);
  }
  if (path === "") {
    throw new Error(`No new pattern found in ${content}`);
  }
  lnum += Math.max(offset - 1, 0);
  return {
    path,
    lnum,
  };
}

async function jump(
  denops: Denops,
  mods: string,
  finder: Finder,
  parser: Parser,
): Promise<void> {
  const [lnum, column, content, bufname] = await batch.collect(
    denops,
    (denops) => [
      fn.line(denops, "."),
      fn.col(denops, "."),
      fn.getline(denops, 1, "$"),
      fn.bufname(denops, "%"),
    ],
  );
  const { expr, params } = parseBufname(bufname);
  const jump = finder(lnum - 1, content);
  if (!jump) {
    // Do nothing
    return;
  }
  const filename = path.join(expr, jump.path.replace(/^[ab]\//, ""));
  const cached = "cached" in (params ?? {});
  const commitish = ensure(params?.commitish ?? "", is.String, {
    message: "commitish must be string",
  });
  const target = parser(commitish, cached);
  if (target === INDEX) {
    await execEdit(denops, filename, {
      worktree: expr,
      mods,
    });
  } else if (target === WORKTREE) {
    await buffer.open(denops, filename, {
      mods,
    });
  } else {
    await execEdit(denops, filename, {
      worktree: expr,
      commitish: commitish || "HEAD",
      mods,
    });
  }
  await fn.cursor(denops, jump.lnum, column - 1);
}

export async function jumpOld(denops: Denops, mods: string): Promise<void> {
  await jump(
    denops,
    mods,
    findJumpOld,
    (commitish: string, cached: boolean) => {
      const [target, _] = parseCommitish(commitish, cached);
      return target;
    },
  );
}

export async function jumpNew(denops: Denops, mods: string): Promise<void> {
  await jump(
    denops,
    mods,
    findJumpNew,
    (commitish: string, cached: boolean) => {
      const [_, target] = parseCommitish(commitish, cached);
      return target;
    },
  );
}

export async function jumpSmart(denops: Denops, mods: string): Promise<void> {
  const line = await fn.getline(denops, ".");
  if (line.startsWith("-")) {
    await jumpOld(denops, mods);
  } else {
    await jumpNew(denops, mods);
  }
}
