import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.17.0/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import { expand } from "./expand.ts";
import { findWorktreeFromDenops } from "../git/worktree.ts";

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "util:reload": (bufnr) => {
      assert(bufnr, is.Number, { name: "bufnr" });
      return buffer.reload(denops, bufnr);
    },

    "util:expand": (expr) => {
      assert(expr, is.String, { name: "expr" });
      return expand(denops, expr);
    },

    "util:worktree": (worktree) => {
      assert(worktree, is.OptionalOf(is.String), {
        name: "worktree",
      });
      return findWorktreeFromDenops(denops, { worktree });
    },
  };
}
