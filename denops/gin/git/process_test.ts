import {
  assert,
  assertRejects,
} from "https://deno.land/std@0.221.0/assert/mod.ts";
import { decodeUtf8 } from "../util/text.ts";
import { execute, ExecuteError, run } from "./process.ts";

Deno.test("run() runs 'git' and return a process", async () => {
  const proc = run(["version"], {
    stdout: "piped",
  });
  const { code, stdout } = await proc.output();
  assert(code === 0);
  assert(decodeUtf8(stdout).startsWith("git version"));
});

Deno.test("run() runs 'git' and return a process (noOptionalLocks)", async () => {
  const proc = run(["version"], {
    stdout: "piped",
    noOptionalLocks: true,
  });
  const { code, stdout } = await proc.output();
  assert(code === 0);
  assert(decodeUtf8(stdout).startsWith("git version"));
});

Deno.test("execute() runs 'git' and return a stdout on success", async () => {
  const stdout = await execute(["version"]);
  assert(decodeUtf8(stdout).startsWith("git version"));
});

Deno.test("execute() runs 'git' and throw ExecuteError on fail", async () => {
  await assertRejects(async () => {
    await execute(["no-such-command"]);
  }, ExecuteError);
});
