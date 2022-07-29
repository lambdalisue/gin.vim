import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v3.5.0/helper/mod.ts";
import * as mapping from "https://deno.land/x/denops_std@v3.5.0/mapping/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.5.0/variable/mod.ts";

export type Action = {
  name: string;
  lhs: string;
  rhs: string;
};

export type Range = [number, number];

export async function list(denops: Denops): Promise<Action[]> {
  const ms = await mapping.list(denops, "<Plug>(gin-action-", { mode: "n" });
  const cs = ms.flatMap((map) => {
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
  return cs;
}

export async function actionChoice(
  denops: Denops,
  range: Range,
): Promise<void> {
  const cs = await list(denops);
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
  await vars.b.set(denops, "denops_action_previous", name);
  await denops.call("gin#action#call", name, range);
}

export async function actionRepeat(
  denops: Denops,
  range: Range,
): Promise<void> {
  const name = await vars.b.get(denops, "denops_action_previous", null) as
    | string
    | null;
  if (name == null) {
    await helper.echo(denops, "[gin] Nothing to repeat");
    return;
  }
  await denops.call("gin#action#call", name, range);
}

export async function actionHelp(
  denops: Denops,
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
