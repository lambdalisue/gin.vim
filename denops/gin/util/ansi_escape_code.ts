import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import { assert, is } from "https://deno.land/x/unknownutil@v3.14.1/mod.ts";
import { unnullish } from "https://deno.land/x/unnullish@v1.0.1/mod.ts";
import * as itertools from "https://deno.land/x/itertools@v1.1.1/mod.ts";
import * as ansiEscapeCode from "https://deno.land/x/ansi_escape_code@v1.0.2/mod.ts";
import * as batch from "https://deno.land/x/denops_std@v6.4.0/batch/mod.ts";
import { Decoration } from "https://deno.land/x/denops_std@v6.4.0/buffer/mod.ts";
import { countVimBytes } from "./text.ts";

export function removeAnsiEscapeCode(
  text: string,
): string {
  const [t, _] = ansiEscapeCode.trimAndParse(text);
  return t;
}

export async function buildDecorationsFromAnsiEscapeCode(
  denops: Denops,
  content: string[],
): Promise<[string[], Decoration[]]> {
  const colors = await denops.call("gin#internal#util#ansi_escape_code#colors");
  assert(colors, is.ArrayOf(is.String), {
    name: "gin#internal#util#ansi_escape_code#colors()",
  });
  const trimmed: string[] = [];
  const decorations: Decoration[] = [];
  const highlights: Map<string, ansiEscapeCode.Sgr> = new Map();
  for (let i = 0; i < content.length; i++) {
    const [t, annons] = ansiEscapeCode.trimAndParse(content[i]);
    let previous: [number, string, ansiEscapeCode.Sgr] | undefined;
    for (const annon of annons) {
      if (!annon.csi.sgr) {
        continue;
      }
      const sgr = {
        ...(previous?.[2] ?? {}),
        ...annon.csi.sgr,
      };
      const highlight = highlightNameFromSgr(sgr);
      if (!highlight) {
        continue;
      }
      highlights.set(highlight, sgr);
      const byteOffset = countVimBytes(t.substring(0, annon.offset));
      if (previous) {
        decorations.push({
          line: i + 1,
          column: 1 + previous[0],
          length: byteOffset - previous[0],
          highlight: previous[1],
        });
      }
      previous = highlight === "NONE"
        ? undefined
        : [byteOffset, highlight, annon.csi.sgr];
    }
    if (previous) {
      decorations.push({
        line: i + 1,
        column: 1 + previous[0],
        length: countVimBytes(t) - previous[0],
        highlight: previous[1],
      });
    }
    trimmed.push(t);
  }
  for (const chunk of itertools.chunked(highlights.entries(), 1000)) {
    await batch.batch(denops, async (denops) => {
      for (const [highlight, sgr] of chunk) {
        const expr = highlightExprFromSgr(sgr, colors);
        if (!expr) {
          continue;
        }
        await denops.cmd(`highlight ${highlight} ${expr}`);
      }
    });
  }
  return [trimmed, decorations];
}

function highlightNameFromSgr(sgr: ansiEscapeCode.Sgr): string {
  if (sgr.reset) {
    return "NONE";
  } else if (sgr.dim) {
    return "Comment";
  }
  const parts = [
    unnullish(sgr.foreground, (v) => `F${formatColor(v)}`),
    unnullish(sgr.background, (v) => `B${formatColor(v)}`),
    unnullish(sgr.bold, (v) => v ? "Bold" : undefined),
    unnullish(sgr.inverse, (v) => v ? "Inverse" : undefined),
    unnullish(sgr.italic, (v) => v ? "Italic" : undefined),
    unnullish(sgr.strike, (v) => v ? "Strike" : undefined),
    unnullish(sgr.underline, (v) => v ? "Underline" : undefined),
  ].filter((v) => v) as string[];
  return parts.length ? `GinColor${parts.join("")}` : "NONE";
}

function highlightExprFromSgr(
  sgr: ansiEscapeCode.Sgr,
  colors: string[],
): string | undefined {
  if (sgr.reset || sgr.dim) {
    return undefined;
  }
  const attrlist = [
    unnullish(sgr.bold, (v) => v ? "bold" : undefined),
    unnullish(sgr.inverse, (v) => v ? "inverse" : undefined),
    unnullish(sgr.italic, (v) => v ? "italic" : undefined),
    unnullish(sgr.strike, (v) => v ? "strikethrough" : undefined),
    unnullish(sgr.underline, (v) => v ? "underline" : undefined),
  ].filter((v) => v).join(",");
  const parts = [
    attrlist ? `cterm=${attrlist} gui=${attrlist}` : `cterm=NONE gui=NONE`,
    unnullish(sgr.foreground, (v) => {
      if (v === "default") {
        return undefined;
      } else if (is.Number(v)) {
        return `ctermfg=${v} guifg=${colors[v]}`;
      } else {
        return `guifg=#${formatColor(v)}`;
      }
    }),
    unnullish(sgr.background, (v) => {
      if (v === "default") {
        return undefined;
      } else if (is.Number(v)) {
        return `ctermbg=${v} guibg=${colors[v]}`;
      } else {
        return `guibg=#${formatColor(v)}`;
      }
    }),
  ].filter((v) => v) as string[];
  return parts.join(" ");
}

function formatColor(color: ansiEscapeCode.Color): string {
  if (color === "default") {
    return "";
  } else if (is.Number(color)) {
    return color.toString();
  } else {
    return color
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  }
}
