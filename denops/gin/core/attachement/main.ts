import type { Denops } from "https://deno.land/x/denops_std@v3.3.0/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.3.0/autocmd/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as attachement from "./attachement.ts";

const optionsRef: attachement.Options = {
  "targets": [],
};

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "attachement:attach_to": (winid, options?) => {
      unknownutil.assertNumber(winid);
      if (options) {
        unknownutil.assertLike(optionsRef, options);
        return attachement.attachTo(denops, winid, options);
      } else {
        return attachement.attachTo(denops, winid);
      }
    },
    "attachement:detach_from": (winid, options?) => {
      unknownutil.assertNumber(winid);
      if (options) {
        unknownutil.assertLike(optionsRef, options);
        return attachement.detachFrom(denops, winid, options);
      } else {
        return attachement.detachFrom(denops, winid);
      }
    },
    "attachement:close_all": (winid) => {
      unknownutil.assertNumber(winid);
      return attachement.closeAll(denops, winid);
    },
  };
  autocmd.group(denops, "gin_core_attachement_main", (helper) => {
    helper.remove();
    helper.define(
      "WinClosed",
      "*",
      // NOTE:
      // This must be NOTIFY to prevent 'E855: Autocommands caused command to abort'
      `call denops#notify('gin', 'attachement:close_all', [expand('<amatch>')+0])`,
    );
  }).catch((e) => {
    console.error(`Unexpected error occurred during autocmd registration`, e);
  });
}
