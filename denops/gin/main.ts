import type { Denops } from "https://deno.land/x/denops_std@v3.3.0/mod.ts";

import { main as mainAction } from "./core/action/main.ts";
import { main as mainAttachement } from "./core/attachement/main.ts";
import { main as mainBare } from "./core/bare/main.ts";
import { main as mainProxy } from "./core/proxy/main.ts";
import { main as mainUtil } from "./core/util/main.ts";

import { main as mainBranch } from "./feat/branch/main.ts";
import { main as mainChaperon } from "./feat/chaperon/main.ts";
import { main as mainDiff } from "./feat/diff/main.ts";
import { main as mainEdit } from "./feat/edit/main.ts";
import { main as mainPatch } from "./feat/patch/main.ts";
import { main as mainStatus } from "./feat/status/main.ts";

import { main as mainComponentBranch } from "./component/branch.ts";
import { main as mainComponentTraffic } from "./component/traffic.ts";
import { main as mainComponentWorktree } from "./component/worktree.ts";

export function main(denops: Denops): void {
  mainAction(denops);
  mainAttachement(denops);
  mainBare(denops);
  mainProxy(denops);
  mainUtil(denops);

  mainBranch(denops);
  mainChaperon(denops);
  mainDiff(denops);
  mainEdit(denops);
  mainPatch(denops);
  mainStatus(denops);

  mainComponentBranch(denops);
  mainComponentTraffic(denops);
  mainComponentWorktree(denops);
}
