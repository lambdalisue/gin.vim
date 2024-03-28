import { assert, is } from "https://deno.land/x/unknownutil@v3.17.0/mod.ts";

export function formatTreeish(
  commitish: string | string[] | undefined,
  relpath: string,
): [] | [string] {
  if (commitish) {
    assert(commitish, is.String, { name: "commitish" });
    return [`${commitish}:${relpath}`];
  } else {
    return [`:${relpath}`];
  }
}
