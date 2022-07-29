import { assertEquals } from "https://deno.land/std@0.150.0/testing/asserts.ts";
import { GitStatusResult } from "./parser.ts";
import { render } from "./render.ts";

Deno.test("render", () => {
  const result: GitStatusResult = {
    branch: {
      ahead: 10,
      behind: 5,
      head: "main",
      oid: "97116f338f304802ce2661c2e7c0593e691736f8",
      upstream: "origin/main",
    },
    entries: [
      {
        XY: ".M",
        hH: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
        hI: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
        kind: "changed",
        mH: "100644",
        mI: "100644",
        mW: "100644",
        path: "README.md",
        sub: "N...",
      },
      {
        XY: ".M",
        Xscore: "R10",
        hH: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
        hI: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
        kind: "renamed",
        mH: "100644",
        mI: "100644",
        mW: "100644",
        origPath: "README",
        path: "README.md",
        sub: "N...",
      },
      {
        XY: "MM",
        h1: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
        h2: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
        h3: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
        kind: "unmerged",
        m1: "100644",
        m2: "100644",
        m3: "100644",
        mW: "100644",
        path: "README.md",
        sub: "N...",
      },
      {
        XY: "!!",
        kind: "ignored",
        path: "README.md",
      },
      {
        XY: "??",
        kind: "untracked",
        path: "README.md",
      },
    ],
  };
  assertEquals(render(result), [
    "## main...origin/main +10 -5",
    " M README.md",
    " M README -> README.md",
    "MM README.md",
    "!! README.md",
    "?? README.md",
  ]);
});
