import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { Commitish, INDEX, parseCommitish, WORKTREE } from "./commitish.ts";

Deno.test("parseCommitish", () => {
  const testcases: [[string, boolean], [Commitish, Commitish]][] = [
    [["", false], [INDEX, WORKTREE]],
    [["A", false], ["A", WORKTREE]],
    [["", true], ["", INDEX]],
    [["A", true], ["A", INDEX]],
    [["A..B", false], ["A", "B"]],
    [["A...B", false], ["A...B", "B"]],
  ];
  for (const [[commitish, cached], [lhs, rhs]] of testcases) {
    assertEquals([lhs, rhs], parseCommitish(commitish, cached));
  }
});
