import type { Denops } from "https://deno.land/x/denops_std@v3.3.0/mod.ts";
import * as anonymous from "https://deno.land/x/denops_std@v3.3.0/anonymous/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.3.0/autocmd/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v3.3.0/batch/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v3.3.0/buffer/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.3.0/function/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.3.0/variable/mod.ts";
import * as unknownutil from "https://deno.land/x/unknownutil@v2.0.0/mod.ts";
import * as path from "https://deno.land/std@0.133.0/path/mod.ts";
import * as streams from "https://deno.land/std@0.133.0/streams/mod.ts";
import { deferred } from "https://deno.land/std@0.133.0/async/mod.ts";
import { decodeUtf8, encodeUtf8 } from "../../util/text.ts";

const recordPattern = /^([^:]+?):(.*)$/;

export async function listen(denops: Denops): Promise<void> {
  const listener = Deno.listen({
    hostname: "127.0.0.1",
    port: 0,
  });
  const [disableAskpass, disableEditor] = await batch.gather(
    denops,
    async (denops) => {
      await vars.g.get(denops, "gin_proxy_disable_askpass");
      await vars.g.get(denops, "gin_proxy_disable_editor");
    },
  );
  await batch.batch(denops, async (denops) => {
    await vars.e.set(
      denops,
      "GIN_PROXY_ADDRESS",
      JSON.stringify(listener.addr),
    );
    if (!unknownutil.ensureBoolean(disableAskpass ?? false)) {
      const script = path.fromFileUrl(new URL("askpass.ts", import.meta.url));
      await vars.e.set(
        denops,
        "GIT_ASKPASS",
        denops.meta.platform === "windows" ? `"${script}"` : `'${script}'`,
      );
    }
    if (!unknownutil.ensureBoolean(disableEditor ?? false)) {
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
  const record = decodeUtf8(await streams.readAll(conn));
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
    await streams.writeAll(conn, encodeUtf8(`ok:${value}`));
  } catch (e: unknown) {
    await streams.writeAll(conn, encodeUtf8(`err:${e}`));
  }
}

async function handleEditor(
  denops: Denops,
  conn: Deno.Conn,
  filename: string,
): Promise<void> {
  try {
    await edit(denops, filename);
    await streams.writeAll(conn, encodeUtf8("ok:"));
  } catch (e: unknown) {
    await streams.writeAll(conn, encodeUtf8(`err:${e}`));
  }
}

async function edit(
  denops: Denops,
  filename: string,
): Promise<void> {
  const { winid, bufnr } = await buffer.open(
    denops,
    filename,
    {
      mods: "silent noswapfile",
      opener: "tabedit",
    },
  );

  // Check if this is the last tabpage or not
  const tabpagenr = await fn.tabpagenr(denops, "$") as number;
  if (tabpagenr === 1) {
    await batch.batch(denops, async (denops) => {
      await denops.cmd("noautocmd | tabnew");
      await fn.win_gotoid(denops, winid);
      await denops.cmd("redraw");
    });
  }

  const auname = `gin_editor_${winid}_${bufnr}`;
  const waiter = deferred<void>();
  const [waiterId] = anonymous.once(denops, () => {
    waiter.resolve();
  });
  await batch.batch(denops, async (denops) => {
    await autocmd.group(denops, auname, (helper) => {
      helper.remove("*", `<buffer=${bufnr}>`);
      helper.define(
        ["WinClosed", "VimLeave"],
        `<buffer=${bufnr}>`,
        `call denops#request('gin', '${waiterId}', [])`,
        {
          once: true,
        },
      );
    });
  });
  await waiter;
}
