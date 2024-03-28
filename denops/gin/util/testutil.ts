import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import {
  test as testOri,
  TestDefinition,
} from "https://deno.land/x/denops_test@v1.6.2/mod.ts";

const runtimepath = path.resolve(
  path.fromFileUrl(new URL("../../..", import.meta.url)),
);

export function test(
  mode: TestDefinition["mode"],
  name: string,
  fn: TestDefinition["fn"],
): void;
export function test(def: TestDefinition): void;
export function test(
  modeOrDef: TestDefinition["mode"] | TestDefinition,
  name?: string,
  fn?: TestDefinition["fn"],
): void {
  if (typeof modeOrDef === "string") {
    if (!name) {
      throw new Error(`'name' attribute is required`);
    }
    if (!fn) {
      throw new Error(`'fn' attribute is required`);
    }
    test({ mode: modeOrDef, name, fn });
    return;
  }
  testOri({
    ...modeOrDef,
    prelude: [
      `set runtimepath^=${runtimepath}`,
      ...(modeOrDef.prelude ?? []),
    ],
  });
}
