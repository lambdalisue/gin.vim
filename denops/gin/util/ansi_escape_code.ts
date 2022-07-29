import * as ansiEscapeCode from "https://deno.land/x/ansi_escape_code@v0.1.2/mod.ts";
import { Decoration } from "https://deno.land/x/denops_std@v3.5.0/buffer/mod.ts";
import { countVimBytes } from "./text.ts";

export function removeAnsiEscapeCode(
  text: string,
): string {
  const [t, _] = ansiEscapeCode.trimAndParse(text);
  return t;
}

export function buildDecorationsFromAnsiEscapeCode(
  content: string[],
): [string[], Decoration[]] {
  const trimmed: string[] = [];
  const decorations: Decoration[] = [];
  for (let i = 0; i < content.length; i++) {
    const [t, annons] = ansiEscapeCode.trimAndParse(content[i]);
    let previous: [number, string] | undefined;
    for (const annon of annons) {
      if (!annon.csi.sgr) {
        continue;
      }
      const highlight = highlightFromSgr(annon.csi.sgr);
      if (!highlight) {
        continue;
      }
      const byteOffset = countVimBytes(t.substring(0, annon.offset));
      if (previous) {
        decorations.push({
          line: i + 1,
          column: 1 + previous[0],
          length: byteOffset - previous[0],
          highlight: previous[1],
        });
      }
      previous = highlight === "NONE" ? undefined : [byteOffset, highlight];
    }
    if (previous) {
      decorations.push({
        line: i + 1,
        column: previous[0],
        length: countVimBytes(t) - previous[0],
        highlight: previous[1],
      });
    }
    trimmed.push(t);
  }
  return [trimmed, decorations];
}

function highlightFromSgr(sgr: ansiEscapeCode.Sgr): string | undefined {
  if (sgr.foreground === "default" || sgr.reset) {
    return "NONE";
  }
  if (sgr.foreground && typeof sgr.foreground === "number") {
    const index = (sgr.bold && sgr.foreground < 8)
      ? sgr.foreground + 8
      : sgr.foreground;
    return `GinColor${index}`;
  }
  // We don't support that SGR
  return undefined;
}
