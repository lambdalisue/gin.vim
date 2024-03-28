import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { parse } from "./parser.ts";

Deno.test(`parse (with --decorate=full`, () => {
  const content = [
    "commit bc7ea737add7cbe9fb29d080d3560fe48b723967 (HEAD -> refs/heads/main, refs/remotes/origin/main, refs/remotes/origin/HEAD)",
    "Author: Alisue <lambdalisue@gmail.com>",
    "Date:   Thu Sep 8 23:42:29 2022 +0900",
    "",
    "    :+1: Allow `--staged` on `GinDiff` command",
    "",
    "commit 5fb7d047cf83710dd3c870e75af577aaeff9a3e5",
    "Author: Alisue <lambdalisue@gmail.com>",
    "Date:   Wed Sep 7 02:06:35 2022 +0900",
    "",
    "    :memo: Add example configuration of component",
    "",
    "commit f24f947b8fc25247844015356b0eb1f846192fb4",
    "Author: Alisue <lambdalisue@gmail.com>",
    "Date:   Wed Sep 7 02:03:44 2022 +0900",
    "",
    "    :+1: Update components when Gin gets ready",
    "",
  ];
  assertEquals(parse(content), {
    entries: [
      { commit: "bc7ea737add7cbe9fb29d080d3560fe48b723967" },
      { commit: "5fb7d047cf83710dd3c870e75af577aaeff9a3e5" },
      { commit: "f24f947b8fc25247844015356b0eb1f846192fb4" },
    ],
  });
});

Deno.test(`parse (with --oneline --decorate=full`, () => {
  const content = [
    "bc7ea73 (HEAD -> refs/heads/main, refs/remotes/origin/main, refs/remotes/origin/HEAD) :+1: Allow `--staged` on `GinDiff` command",
    "5fb7d04 :memo: Add example configuration of component",
    "f24f947 :+1: Update components when Gin gets ready",
  ];
  assertEquals(parse(content), {
    entries: [
      { commit: "bc7ea73" },
      { commit: "5fb7d04" },
      { commit: "f24f947" },
    ],
  });
});

Deno.test(`parse (with --graph --oneline --decorate=full)`, () => {
  const content = [
    "* bc7ea73 (HEAD -> refs/heads/main, refs/remotes/origin/main, refs/remotes/origin/HEAD) :+1: Allow `--staged` on `GinDiff` command",
    "* 5fb7d04 :memo: Add example configuration of component",
    "| *   24f4ff5 (refs/stash) WIP on main: 926bde3 :bug: Fix `GinDiff/GinStatus` with path contain spaces",
    "|/|\\  ",
    "| | * 6f47ca6 untracked files on main: 926bde3 :bug: Fix `GinDiff/GinStatus` with path contain spaces",
    "| * ef182c6 index on main: 926bde3 :bug: Fix `GinDiff/GinStatus` with path contain spaces",
    "|/  ",
    "* 926bde3 :bug: Fix `GinDiff/GinStatus` with path contain spaces",
    "...",
    "*   940d8e8 Merge pull request #56 from lambdalisue/support-processor",
    "|\\  ",
    "| * e8218f5 :shower: Remove unnecessary workaround",
  ];
  assertEquals(parse(content), {
    entries: [
      { commit: "bc7ea73" },
      { commit: "5fb7d04" },
      { commit: "24f4ff5" },
      { commit: "6f47ca6" },
      { commit: "ef182c6" },
      { commit: "926bde3" },
      { commit: "940d8e8" },
      { commit: "e8218f5" },
    ],
  });
});

Deno.test(`parse (with --graph --oneline --decorate=full)`, () => {
  const content = [
    "* bc7ea73 (HEAD -> refs/heads/main, refs/remotes/origin/main, refs/remotes/origin/HEAD) :+1: Allow `--staged` on `GinDiff` command",
    "* 5fb7d04 :memo: Add example configuration of component",
    "| *   24f4ff5 (refs/stash) WIP on main: 926bde3 :bug: Fix `GinDiff/GinStatus` with path contain spaces",
    "|/|\\  ",
    "| | * 6f47ca6 untracked files on main: 926bde3 :bug: Fix `GinDiff/GinStatus` with path contain spaces",
    "| * ef182c6 index on main: 926bde3 :bug: Fix `GinDiff/GinStatus` with path contain spaces",
    "|/  ",
    "* 926bde3 :bug: Fix `GinDiff/GinStatus` with path contain spaces",
    "...",
    "*   940d8e8 Merge pull request #56 from lambdalisue/support-processor",
    "|\\  ",
    "| * e8218f5 :shower: Remove unnecessary workaround",
  ];
  assertEquals(parse(content), {
    entries: [
      { commit: "bc7ea73" },
      { commit: "5fb7d04" },
      { commit: "24f4ff5" },
      { commit: "6f47ca6" },
      { commit: "ef182c6" },
      { commit: "926bde3" },
      { commit: "940d8e8" },
      { commit: "e8218f5" },
    ],
  });
});

Deno.test(`parse (with special prefixes)`, () => {
  const content = [
    "+ bc7ea73 :+1: Allow `--staged` on `GinDiff` command",
    "- bc7ea73 :+1: Allow `--staged` on `GinDiff` command",
    "= bc7ea73 :+1: Allow `--staged` on `GinDiff` command",
    "< bc7ea73 :+1: Allow `--staged` on `GinDiff` command",
    "> bc7ea73 :+1: Allow `--staged` on `GinDiff` command",
    "commit + 5fb7d047cf83710dd3c870e75af577aaeff9a3e5",
    "commit - 5fb7d047cf83710dd3c870e75af577aaeff9a3e5",
    "commit = 5fb7d047cf83710dd3c870e75af577aaeff9a3e5",
    "commit < 5fb7d047cf83710dd3c870e75af577aaeff9a3e5",
    "commit > 5fb7d047cf83710dd3c870e75af577aaeff9a3e5",
  ];
  assertEquals(parse(content), {
    entries: [
      { commit: "bc7ea73" },
      { commit: "bc7ea73" },
      { commit: "bc7ea73" },
      { commit: "bc7ea73" },
      { commit: "bc7ea73" },
      { commit: "5fb7d047cf83710dd3c870e75af577aaeff9a3e5" },
      { commit: "5fb7d047cf83710dd3c870e75af577aaeff9a3e5" },
      { commit: "5fb7d047cf83710dd3c870e75af577aaeff9a3e5" },
      { commit: "5fb7d047cf83710dd3c870e75af577aaeff9a3e5" },
      { commit: "5fb7d047cf83710dd3c870e75af577aaeff9a3e5" },
    ],
  });
});
