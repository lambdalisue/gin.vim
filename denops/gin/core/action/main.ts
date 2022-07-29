import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as registry from "./registry.ts";
import * as action from "./action.ts";

const rangeRef: [number, number] = [0, 0];

export function main(denops: Denops): void {
  denops.dispatcher = {
    ...denops.dispatcher,
    "action:list_actions": () => {
      return action.list(denops);
    },
    "action:gather_candidates": (range) => {
      unknownutil.assertLike(rangeRef, range);
      return registry.gatherCandidates(denops, range);
    },
    "action:action:choice": (range) => {
      unknownutil.assertLike(rangeRef, range);
      return action.actionChoice(denops, range);
    },
    "action:action:repeat": (range) => {
      unknownutil.assertLike(rangeRef, range);
      return action.actionRepeat(denops, range);
    },
    "action:action:help": (range, reduced) => {
      unknownutil.assertLike(rangeRef, range);
      unknownutil.assertBoolean(reduced);
      return action.actionHelp(denops, range, reduced);
    },
  };
}
