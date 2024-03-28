import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.0.1/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.0.1/function/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import { deadline } from "https://deno.land/std@0.221.0/async/mod.ts";
import { test } from "./testutil.ts";
import { normCmdArgs } from "./cmd.ts";

test("all", "cmd", async (denops, t) => {
  await t.step({
    name: "normCmdArgs does nothing on args without '%' or '#'",
    fn: async () => {
      await denops.cmd("%bwipeout!");
      await batch.batch(denops, async (denops) => {
        await denops.cmd("edit dummy1");
        await denops.cmd("file dummy2");
      });
      const src = ["a", "b", "c"];
      const dst = await normCmdArgs(denops, src);
      const exp = src;
      assertEquals(dst, exp);
    },
  });
  await t.step({
    name: "normCmdArgs does not expand arg starts from '\%' or '\#'",
    fn: async () => {
      await denops.cmd("%bwipeout!");
      await batch.batch(denops, async (denops) => {
        await denops.cmd("edit dummy1");
        await denops.cmd("file dummy2");
      });
      const src = ["\\%", "\\%:p", "\\%hello", "\\#", "\\#:p", "\\#hello"];
      const dst = await normCmdArgs(denops, src);
      const exp = [
        "%",
        "%:p",
        "%hello",
        "#",
        "#:p",
        "#hello",
      ];
      assertEquals(dst, exp);
    },
  });
  await t.step({
    name: "normCmdArgs expands arg starts from '%' or '#'",
    fn: async () => {
      await denops.cmd("%bwipeout!");
      await batch.batch(denops, async (denops) => {
        await denops.cmd("edit dummy1");
        await denops.cmd("file dummy2");
      });
      const cwd = await fn.getcwd(denops);
      const src = ["%", "%:p", "%hello", "#", "#:p", "#hello"];
      const dst = await normCmdArgs(denops, src);
      const exp = [
        "dummy2",
        path.join(cwd, "dummy2"),
        "dummy2",
        "dummy1",
        path.join(cwd, "dummy1"),
        "dummy1",
      ];
      assertEquals(dst, exp);
    },
  });
  await t.step({
    name: "normCmdArgs expands massive args starts from '%' or '#'",
    fn: async () => {
      await denops.cmd("%bwipeout!");
      await batch.batch(denops, async (denops) => {
        await denops.cmd("edit dummy1");
        await denops.cmd("file dummy2");
      });
      const src = [
        ...Array(10000).fill("%"),
        ...Array(10000).fill("#"),
      ];
      const dst = await deadline(normCmdArgs(denops, src), 1000);
      const exp = [
        ...Array(10000).fill("dummy2"),
        ...Array(10000).fill("dummy1"),
      ];
      assertEquals(dst, exp);
    },
  });
});
