import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.221.0/assert/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import { find } from "./finder.ts";
import { ExecuteError } from "./process.ts";

Deno.test({
  name: "find() returns a root path of a git working directory",
  fn: async () => {
    const exp = path.resolve(
      path.fromFileUrl(import.meta.url),
      "../../../../",
    );
    assertEquals(await find("."), exp);
    // An internal cache will be used for the following call
    assertEquals(await find("."), exp);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});

Deno.test({
  name: "find() throws an error if the path is not in a git working directory",
  fn: async () => {
    await assertRejects(async () => {
      await find("/");
    }, ExecuteError);
    // An internal cache will be used for the following call
    await assertRejects(async () => {
      await find("/");
    }, ExecuteError);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
