import { assertEquals } from "https://deno.land/std@0.150.0/testing/asserts.ts";
import * as bytes from "https://deno.land/std@0.150.0/bytes/mod.ts";
import { encodeUtf8 } from "../../util/text.ts";
import {
  parse,
  parseBranchHeaders,
  parseChangedEntry,
  parseIgnoredEntry,
  parseRenamedEntry,
  parseUnmergedEntry,
  parseUntrackedEntry,
} from "./parser.ts";

Deno.test(`parse`, () => {
  const input = [
    "# branch.oid 97116f338f304802ce2661c2e7c0593e691736f8",
    "# branch.head main",
    "# branch.upstream origin/main",
    "# branch.ab +10 -5",
    "1 .M N... 100644 100644 100644 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 README.md",
    "2 .M N... 100644 100644 100644 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 R10 README.md",
    "README",
    "u MM N... 100644 100644 100644 100644 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 README.md",
    "! README.md",
    "? README.md",
  ];
  const data = input.map(encodeUtf8).reduce((a, v) =>
    bytes.concat(a, new Uint8Array([0x00]), v)
  );
  assertEquals(parse(data), {
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
  });
});

const parseBranchHeadersTestCases = [
  {
    input: "# branch.oid 97116f338f304802ce2661c2e7c0593e691736f8",
    expected: {
      oid: "97116f338f304802ce2661c2e7c0593e691736f8",
    },
  },
  {
    input: "# branch.oid (initial)",
    expected: {
      oid: "(initial)",
    },
  },
  {
    input: "# branch.head main",
    expected: {
      head: "main",
    },
  },
  {
    input: "# branch.head (detached)",
    expected: {
      head: "(detached)",
    },
  },
  {
    input: "# branch.upstream main",
    expected: {
      upstream: "main",
    },
  },
  {
    input: "# branch.ab +10 -5",
    expected: {
      ahead: 10,
      behind: 5,
    },
  },
];
for (const { input, expected } of parseBranchHeadersTestCases) {
  Deno.test(`parseBranchHeaders (${input})`, () => {
    assertEquals(parseBranchHeaders(input), expected);
  });
}

const parseChangedEntryTestCases = [
  {
    input:
      "1 .M N... 100644 100644 100644 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 README.md",
    expected: {
      kind: "changed",
      XY: ".M",
      sub: "N...",
      mH: "100644",
      mI: "100644",
      mW: "100644",
      hH: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      hI: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      path: "README.md",
    },
  },
  {
    input:
      "1 .M N... 100644 100644 100644 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 R E A D M E.md",
    expected: {
      kind: "changed",
      XY: ".M",
      sub: "N...",
      mH: "100644",
      mI: "100644",
      mW: "100644",
      hH: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      hI: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      path: "R E A D M E.md",
    },
  },
];
for (const { input, expected } of parseChangedEntryTestCases) {
  Deno.test(`parseChangedEntry (${input})`, () => {
    assertEquals(parseChangedEntry(input), expected);
  });
}

const parseRenamedEntryTestCases = [
  {
    input:
      "2 .M N... 100644 100644 100644 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 R10 README.md",
    origPath: "README",
    expected: {
      kind: "renamed",
      XY: ".M",
      sub: "N...",
      mH: "100644",
      mI: "100644",
      mW: "100644",
      hH: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      hI: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      Xscore: "R10",
      path: "README.md",
      origPath: "README",
    },
  },
  {
    input:
      "2 .M N... 100644 100644 100644 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 R10 R E A D M E.md",
    origPath: "R E A D M E",
    expected: {
      kind: "renamed",
      XY: ".M",
      sub: "N...",
      mH: "100644",
      mI: "100644",
      mW: "100644",
      hH: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      hI: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      Xscore: "R10",
      path: "R E A D M E.md",
      origPath: "R E A D M E",
    },
  },
];
for (const { input, origPath, expected } of parseRenamedEntryTestCases) {
  Deno.test(`parseRenamedEntry (${input}<NUL>${origPath})`, () => {
    assertEquals(parseRenamedEntry(input, origPath), expected);
  });
}

const parseUnmergedEntryTestCases = [
  {
    input:
      "u MM N... 100644 100644 100644 100644 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 README.md",
    expected: {
      kind: "unmerged",
      XY: "MM",
      sub: "N...",
      m1: "100644",
      m2: "100644",
      m3: "100644",
      mW: "100644",
      h1: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      h2: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      h3: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      path: "README.md",
    },
  },
  {
    input:
      "u MM N... 100644 100644 100644 100644 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 be121c5629d3d6f845ba0247512bcf793fcea3d1 R E A D M E.md",
    expected: {
      kind: "unmerged",
      XY: "MM",
      sub: "N...",
      m1: "100644",
      m2: "100644",
      m3: "100644",
      mW: "100644",
      h1: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      h2: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      h3: "be121c5629d3d6f845ba0247512bcf793fcea3d1",
      path: "R E A D M E.md",
    },
  },
];
for (const { input, expected } of parseUnmergedEntryTestCases) {
  Deno.test(`parseUnmergedEntry (${input})`, () => {
    assertEquals(parseUnmergedEntry(input), expected);
  });
}

const parseUntrackedEntryTestCases = [
  {
    input: "? README.md",
    expected: {
      kind: "untracked",
      XY: "??",
      path: "README.md",
    },
  },
  {
    input: "? R E A D M E.md",
    expected: {
      kind: "untracked",
      XY: "??",
      path: "R E A D M E.md",
    },
  },
];
for (const { input, expected } of parseUntrackedEntryTestCases) {
  Deno.test(`parseUntrackedEntry (${input})`, () => {
    assertEquals(parseUntrackedEntry(input), expected);
  });
}

const parseIgnoredEntryTestCases = [
  {
    input: "! README.md",
    expected: {
      kind: "ignored",
      XY: "!!",
      path: "README.md",
    },
  },
  {
    input: "! R E A D M E.md",
    expected: {
      kind: "ignored",
      XY: "!!",
      path: "R E A D M E.md",
    },
  },
];
for (const { input, expected } of parseIgnoredEntryTestCases) {
  Deno.test(`parseIgnoredEntry (${input})`, () => {
    assertEquals(parseIgnoredEntry(input), expected);
  });
}
