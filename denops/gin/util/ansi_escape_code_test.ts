import {
  assertSnapshot,
} from "https://deno.land/std@0.221.0/testing/snapshot.ts";
import { test } from "./testutil.ts";
import { buildDecorationsFromAnsiEscapeCode } from "./ansi_escape_code.ts";

const testText = await Deno.readTextFile(
  new URL("./testdata/ansi_escape_code_content.txt", import.meta.url),
);

// Based on the Deno.inspect enhancements added in Deno 1.36, assertSnapshot has undergone
// a destructive change, so those supporting Deno 1.36 or earlier can only specify a custom
// serializer to ensure backward compatibility.
// https://github.com/denoland/deno_std/pull/3447#issuecomment-1666839964
const serializer = (v: unknown): string =>
  Deno.inspect(v, {
    depth: Infinity,
    sorted: true,
    trailingComma: true,
    compact: false,
    iterableLimit: Infinity,
    strAbbreviateSize: Infinity,
    breakLength: Infinity, // Added in Deno 1.36.0
    escapeSequences: true, // Added in Deno 1.36.0
    // deno-lint-ignore no-explicit-any
  } as any);

test("all", "buildDecorationsFromAnsiEscapeCode", async (denops, t) => {
  await t.step({
    name: "returns proper Decoration[]",
    fn: async () => {
      const content = testText.split("\n");
      const [trimmed, decorations] = await buildDecorationsFromAnsiEscapeCode(
        denops,
        content,
      );
      await assertSnapshot(t, {
        content,
        trimmed,
        decorations,
      }, {
        serializer,
      });
    },
  });
});
