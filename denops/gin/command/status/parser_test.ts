import { assertEquals } from "https://deno.land/std@0.221.0/assert/mod.ts";
import { parse } from "./parser.ts";

Deno.test(`parse`, () => {
  const content = [
    "## main...origin/main +10 -5",
    " M README.md",
    " M README -> README.md",
    "MM README.md",
    "!! README.md",
    "?? README.md",
  ];
  assertEquals(parse(content), {
    entries: [
      {
        XY: ".M",
        path: "README.md",
      },
      {
        XY: ".M",
        origPath: "README",
        path: "README.md",
      },
      {
        XY: "MM",
        path: "README.md",
      },
      {
        XY: "!!",
        path: "README.md",
      },
      {
        XY: "??",
        path: "README.md",
      },
    ],
  });
});

Deno.test(`parse with spaces`, () => {
  const content = [
    "## main...origin/main +10 -5",
    ' M "R E A D M E.md"',
    ' M "R E A D M E" -> "R E A D M E.md"',
    'MM "R E A D M E.md"',
    '!! "R E A D M E.md"',
    '?? "R E A D M E.md"',
  ];
  assertEquals(parse(content), {
    entries: [
      {
        XY: ".M",
        path: "R E A D M E.md",
      },
      {
        XY: ".M",
        origPath: "R E A D M E",
        path: "R E A D M E.md",
      },
      {
        XY: "MM",
        path: "R E A D M E.md",
      },
      {
        XY: "!!",
        path: "R E A D M E.md",
      },
      {
        XY: "??",
        path: "R E A D M E.md",
      },
    ],
  });
});
