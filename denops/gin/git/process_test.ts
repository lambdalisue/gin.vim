import {
  assert,
  assertRejects,
} from "https://deno.land/std@0.150.0/testing/asserts.ts";
import { decodeUtf8 } from "../util/text.ts";
import { execute, ExecuteError, run } from "./process.ts";

Deno.test("run() runs 'git' and return a process", async () => {
  const proc = run(["version"], {
    stdout: "piped",
  });
  const [status, stdout] = await Promise.all([
    proc.status(),
    proc.output(),
  ]);
  proc.close();
  assert(status.success);
  assert(decodeUtf8(stdout).startsWith("git version"));
});

Deno.test("run() runs 'git' and return a process (noOptionalLocks)", async () => {
  const proc = run(["version"], {
    stdout: "piped",
    noOptionalLocks: true,
  });
  const [status, stdout] = await Promise.all([
    proc.status(),
    proc.output(),
  ]);
  proc.close();
  assert(status.success);
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
