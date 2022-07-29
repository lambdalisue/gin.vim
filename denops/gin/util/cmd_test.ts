import { assertEquals } from "https://deno.land/std@0.150.0/testing/asserts.ts";
import { test } from "https://deno.land/x/denops_std@v3.5.0/test/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.5.0/batch/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.5.0/function/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as path from "https://deno.land/std@0.150.0/path/mod.ts";
import { deadline } from "https://deno.land/std@0.150.0/async/mod.ts";
import { normCmdArgs } from "./cmd.ts";

const runtimepath = path.resolve(
  path.fromFileUrl(`${import.meta.url}/../../../..`),
);

console.log("runtimepath", runtimepath);

test({
  mode: "any",
  name: "normCmdArgs does nothing on args without '%' or '#'",
  fn: async (denops) => {
    await batch.batch(denops, async (denops) => {
      await denops.cmd("edit dummy1");
      await denops.cmd("file dummy2");
    });
    const src = ["a", "b", "c"];
    const dst = await normCmdArgs(denops, src);
    const exp = src;
    assertEquals(dst, exp);
  },
  prelude: [`set runtimepath^=${runtimepath}`],
});
test({
  mode: "any",
  name: "normCmdArgs does not expand arg starts from '\%' or '\#'",
  fn: async (denops) => {
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
  prelude: [`set runtimepath^=${runtimepath}`],
});
test({
  mode: "all",
  name: "normCmdArgs expands arg starts from '%' or '#'",
  fn: async (denops) => {
    await batch.batch(denops, async (denops) => {
      await denops.cmd("edit dummy1");
      await denops.cmd("file dummy2");
    });
    const cwd = unknownutil.ensureString(await fn.getcwd(denops));
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
  prelude: [`set runtimepath^=${runtimepath}`],
});
test({
  mode: "all",
  name: "normCmdArgs expands massive args starts from '%' or '#'",
  fn: async (denops) => {
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
  prelude: [`set runtimepath^=${runtimepath}`],
});
