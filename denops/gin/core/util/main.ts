import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v3.5.0/buffer/mod.ts";
import { expand } from "../../util/cmd.ts";

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "util:reload": (bufnr) => {
      unknownutil.assertNumber(bufnr);
      return buffer.reload(denops, bufnr);
    },

    "util:expand": (expr) => {
      unknownutil.assertString(expr);
      return expand(denops, expr);
    },
  };
}
