import { assertSnapshot } from "https://deno.land/std@0.221.0/testing/snapshot.ts";
import { parse } from "./parser.ts";

Deno.test("parse", async function (t): Promise<void> {
  await t.step("returns proper branches", async (t) => {
    const content = await Deno.readTextFile(
      new URL("./testdata/branch.txt", import.meta.url),
    );
    const result = parse(content.split("\n"));
    await assertSnapshot(t, result);
  });

  await t.step("returns proper branches even with worktree", async (t) => {
    const content = await Deno.readTextFile(
      new URL("./testdata/branch-with-worktree.txt", import.meta.url),
    );
    const result = parse(content.split("\n"));
    await assertSnapshot(t, result);
  });
});
