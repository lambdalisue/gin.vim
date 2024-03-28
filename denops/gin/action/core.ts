import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import * as buffer from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v6.4.0/helper/mod.ts";
import * as mapping from "https://deno.land/x/denops_std@v6.4.0/mapping/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";

let rangeInternal: Range | undefined;

export type GatherCandidates<T> = (
  denops: Denops,
  bufnr: number,
  range: Range,
) => Promise<T[]>;

export type Action = {
  name: string;
  lhs: string;
  rhs: string;
};

export type Range = [number, number];

export type Callback = (
  denops: Denops,
  bufnr: number,
  range: Range,
) => Promise<void>;

export async function init(denops: Denops, bufnr: number): Promise<void> {
  await batch.batch(denops, async (denops) => {
    await define(denops, bufnr, "choice", doChoice);
    await define(denops, bufnr, "repeat", doRepeat);
    await define(
      denops,
      bufnr,
      "help",
      (denops, bufnr, range) => doHelp(denops, bufnr, range, true),
    );
    await define(
      denops,
      bufnr,
      "help:all",
      (denops, bufnr, range) => doHelp(denops, bufnr, range, false),
    );
  });
}

export async function list(
  denops: Denops,
  bufnr: number,
): Promise<Action[]> {
  let cs: Action[] = [];
  await buffer.ensure(denops, bufnr, async () => {
    const ms = await mapping.list(denops, "<Plug>(gin-action-", { mode: "n" });
    cs = ms.flatMap((map) => {
      const m = map.lhs.match(/^<Plug>\(gin-action-(.*)\)$/);
      if (!m) {
        return [];
      }
      return [{
        lhs: map.lhs,
        rhs: map.rhs,
        name: m[1],
      }];
    });
  });
  return cs;
}

export async function call(
  denops: Denops,
  name: string,
  range: Range,
): Promise<void> {
  const rangeSaved = rangeInternal;
  rangeInternal = [...range];
  try {
    await fn.execute(
      denops,
      `call feedkeys("\\<Plug>(gin-action-${name})\\<Ignore>", 'x')`,
    );
  } finally {
    rangeInternal = rangeSaved;
  }
}

export async function define(
  denops: Denops,
  bufnr: number,
  name: string,
  callback: Callback,
  options: Omit<mapping.MapOptions, "buffer" | "silent" | "noremap"> = {},
): Promise<void> {
  denops.dispatcher = {
    ...denops.dispatcher,
    [`action:action:${name}`]: async (bufnr) => {
      assert(bufnr, is.Number);
      await helper.friendlyCall(denops, async () => {
        await buffer.ensure(denops, bufnr, async () => {
          const range = await getRange(denops);
          await callback(denops, bufnr, range);
        });
      });
    },
  };
  await mapping.map(
    denops,
    `<Plug>(gin-action-${name})`,
    `<Cmd>call denops#request('gin', 'action:action:${name}', [${bufnr}])<CR>`,
    { ...options, buffer: true, silent: true, noremap: true },
  );
}

export async function alias(
  denops: Denops,
  _bufnr: number,
  name: string,
  to: string,
): Promise<void> {
  await mapping.map(
    denops,
    `<Plug>(gin-action-${name})`,
    `<Plug>(gin-action-${to})`,
    { buffer: true },
  );
}

async function getRange(denops: Denops): Promise<Range> {
  if (rangeInternal) {
    return rangeInternal;
  }
  const [mode, line1, line2] = await batch.collect(denops, (denops) => [
    fn.mode(denops),
    fn.line(denops, "."),
    fn.line(denops, "v"),
  ]);
  if (mode === "n") {
    return [line1, line1];
  }
  return line1 < line2 ? [line1, line2] : [line2, line1];
}

async function doChoice(
  denops: Denops,
  bufnr: number,
  range: Range,
): Promise<void> {
  const cs = await list(denops, bufnr);
  const name = await helper.input(denops, {
    prompt: "action: ",
    completion: (
      arglead: string,
      _cmdline: string,
      _cursorpos: number,
    ) => {
      return Promise.resolve(
        cs.filter((c) => c.name.startsWith(arglead)).map((c) => c.name),
      );
    },
  });
  if (name == null) {
    return;
  }
  await fn.setbufvar(denops, bufnr, "denops_action_previous", name);
  await call(denops, name, range);
}

async function doRepeat(
  denops: Denops,
  bufnr: number,
  range: Range,
): Promise<void> {
  const name = await fn.getbufvar(
    denops,
    bufnr,
    "denops_action_previous",
  );
  if (!name) {
    await helper.echo(denops, "[gin] Nothing to repeat");
    return;
  }
  assert(name, is.String, { name: `b:denops_action_previous` });
  await call(denops, name, range);
}

async function doHelp(
  denops: Denops,
  _bufnr: number,
  _range: Range,
  reduced: boolean,
): Promise<void> {
  const ms = await mapping.list(denops, "");
  const actions: Record<string, Action> = {};
  for (const m of ms) {
    const n1 = parseMapExpr(m.lhs);
    const n2 = parseMapExpr(m.rhs);
    if (reduced && n1 && (n1.includes(":") || n1.includes("="))) {
      continue;
    }
    const n = n1 ?? n2;
    if (!n) {
      continue;
    }
    const a = actions[n] ?? {
      name: n,
      lhs: "",
      rhs: "",
    };
    if (n1) {
      a.rhs = m.lhs;
    } else if (n2) {
      a.lhs = m.lhs;
      a.rhs = m.rhs;
    }
    actions[n] = a;
  }
  if (!Object.keys(actions).length) {
    return;
  }
  const records = Object.values(actions)
    .sort((a, b) => a.name === b.name ? 0 : a.name > b.name ? 1 : -1)
    .map((a) => [
      a.lhs,
      a.name,
      a.rhs,
    ]);
  // Find longest length of each column
  const columns = [0, 0, 0];
  for (const r of records) {
    for (let i = 0; i < columns.length; i++) {
      if (columns[i] < r[i].length) {
        columns[i] = r[i].length;
      }
    }
  }
  const lines = records
    .map((r) => r.map((c, index) => c.padEnd(columns[index])).join("  "));
  if (reduced) {
    const msg = "Use 'help:all' action to see complete help.";
    const len = Math.max(lines[0].length, msg.length);
    const pad = Math.floor((len - msg.length) / 2);
    await helper.echo(
      denops,
      [
        "~".repeat(len),
        " ".repeat(pad) + msg,
        "~".repeat(len),
        ...lines,
      ].join("\n"),
    );
  } else {
    await helper.echo(denops, lines.join("\n"));
  }
}

function parseMapExpr(expr: string): string | undefined {
  const m = expr.match(/^<Plug>\(gin-action-(.*)\)$/);
  if (!m) {
    return;
  }
  return m[1];
}
