import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { findJumpNew, findJumpOld, Jump } from "./jump.ts";

const example = (await Deno.readTextFile(
  new URL("./jump_test.diff", import.meta.url),
)).split("\n");

Deno.test("findOldJump", () => {
  const testcases: [number, Jump | undefined][] = [
    [0, undefined],
    [1, undefined],
    [2, undefined],
    [3, { path: "a/path/to/lao", lnum: 1 }],
    [4, { path: "a/path/to/lao", lnum: 2 }],
    [5, { path: "a/path/to/lao", lnum: 3 }],
    [6, { path: "a/path/to/lao", lnum: 4 }],
    [7, { path: "a/path/to/lao", lnum: 4 }],
    [8, { path: "a/path/to/lao", lnum: 4 }],
    [9, { path: "a/path/to/lao", lnum: 5 }],
    [10, { path: "a/path/to/lao", lnum: 6 }],
    [11, { path: "a/path/to/lao", lnum: 7 }],
    [12, undefined],
    [13, { path: "a/path/to/lao", lnum: 9 }],
    [14, { path: "a/path/to/lao", lnum: 10 }],
    [15, { path: "a/path/to/lao", lnum: 11 }],
    [16, { path: "a/path/to/lao", lnum: 11 }],
    [17, { path: "a/path/to/lao", lnum: 11 }],
    [18, { path: "a/path/to/lao", lnum: 11 }],
  ];
  for (const [idx, exp] of testcases) {
    assertEquals(exp, findJumpOld(idx, example));
  }
});

Deno.test("findNewJump", () => {
  const testcases: [number, Jump | undefined][] = [
    [0, undefined],
    [1, undefined],
    [2, undefined],
    [3, { path: "b/path/to/tzu", lnum: 1 }],
    [4, { path: "b/path/to/tzu", lnum: 1 }],
    [5, { path: "b/path/to/tzu", lnum: 1 }],
    [6, { path: "b/path/to/tzu", lnum: 1 }],
    [7, { path: "b/path/to/tzu", lnum: 2 }],
    [8, { path: "b/path/to/tzu", lnum: 3 }],
    [9, { path: "b/path/to/tzu", lnum: 4 }],
    [10, { path: "b/path/to/tzu", lnum: 5 }],
    [11, { path: "b/path/to/tzu", lnum: 6 }],
    [12, undefined],
    [13, { path: "b/path/to/tzu", lnum: 8 }],
    [14, { path: "b/path/to/tzu", lnum: 9 }],
    [15, { path: "b/path/to/tzu", lnum: 10 }],
    [16, { path: "b/path/to/tzu", lnum: 11 }],
    [17, { path: "b/path/to/tzu", lnum: 12 }],
    [18, { path: "b/path/to/tzu", lnum: 13 }],
  ];
  for (const [idx, exp] of testcases) {
    assertEquals(exp, findJumpNew(idx, example));
  }
});
