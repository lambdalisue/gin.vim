import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as lambda from "https://deno.land/x/denops_std@v6.4.0/lambda/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import * as path from "https://deno.land/std@0.221.0/path/mod.ts";
import { pop, push } from "https://deno.land/x/streamtools@v0.5.0/mod.ts";
import { decodeUtf8, encodeUtf8 } from "../util/text.ts";

const recordPattern = /^([^:]+?):(.*)$/;

export async function listen(denops: Denops): Promise<void> {
  const listener = Deno.listen({
    hostname: "127.0.0.1",
    port: 0,
  });
  const [disableAskpass, disableEditor] = await batch.collect(
    denops,
    (denops) => [
      vars.g.get(denops, "gin_proxy_disable_askpass"),
      vars.g.get(denops, "gin_proxy_disable_editor"),
    ],
  );
  await batch.batch(denops, async (denops) => {
    await vars.e.set(
      denops,
      "GIN_PROXY_ADDRESS",
      JSON.stringify(listener.addr),
    );
    if (
      !ensure(disableAskpass ?? false, is.Boolean, {
        message: "g:gin_proxy_disable_askpass must be boolean",
      })
    ) {
      const script = path.fromFileUrl(new URL("askpass.ts", import.meta.url));
      await vars.e.set(
        denops,
        "GIT_ASKPASS",
        denops.meta.platform === "windows" ? `"${script}"` : `'${script}'`,
      );
    }
    if (
      !ensure(disableEditor ?? false, is.Boolean, {
        message: "g:gin_proxy_disable_editor must be boolean",
      })
    ) {
      const script = path.fromFileUrl(new URL("editor.ts", import.meta.url));
      await vars.e.set(
        denops,
        "GIT_EDITOR",
        denops.meta.platform === "windows" ? `"${script}"` : `'${script}'`,
      );
    }
  });
  for await (const conn of listener) {
    handleConnection(denops, conn).catch((e) => console.error(e));
  }
}

async function handleConnection(
  denops: Denops,
  conn: Deno.Conn,
): Promise<void> {
  const record = decodeUtf8(
    ensure(await pop(conn.readable), is.InstanceOf(Uint8Array)),
  );
  const m = record.match(recordPattern);
  if (!m) {
    throw new Error(`Unexpected record '${record}' received`);
  }
  const [name, value] = m.slice(1);
  try {
    switch (name) {
      case "askpass":
        await handleAskpass(denops, conn, value);
        break;
      case "editor":
        await handleEditor(denops, conn, value);
        break;
      default:
        throw new Error(`Unexpected record prefix '${name}' received`);
    }
  } finally {
    conn.close();
  }
}

async function handleAskpass(
  denops: Denops,
  conn: Deno.Conn,
  prompt: string,
): Promise<void> {
  try {
    const value = await fn.inputsecret(denops, prompt);
    await push(conn.writable, encodeUtf8(`ok:${value}`));
  } catch (e: unknown) {
    await push(conn.writable, encodeUtf8(`err:${e}`));
  }
}

async function handleEditor(
  denops: Denops,
  conn: Deno.Conn,
  filename: string,
): Promise<void> {
  try {
    if (await edit(denops, filename)) {
      await push(conn.writable, encodeUtf8("ok:"));
    } else {
      await Deno.writeFile(filename, new Uint8Array());
      await push(conn.writable, encodeUtf8("cancel:"));
    }
  } catch (e: unknown) {
    await push(conn.writable, encodeUtf8(`err:${e}`));
  }
}

async function edit(
  denops: Denops,
  filename: string,
): Promise<boolean> {
  const opener = await vars.g.get(denops, "gin_proxy_editor_opener", "tabedit");
  const { bufnr } = await buffer.open(
    denops,
    filename,
    {
      mods: "silent",
      opener,
    },
  );

  const { promise, resolve } = Promise.withResolvers<boolean>();
  const waiterId = lambda.register(denops, (accept) => {
    resolve(!!accept);
  }, { once: true });
  await buffer.ensure(denops, bufnr, async () => {
    await denops.call("gin#internal#proxy#init", waiterId);
  });
  return promise;
}
