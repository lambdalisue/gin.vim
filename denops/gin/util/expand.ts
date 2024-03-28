import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import { parse as parseBufname } from "https://deno.land/x/denops_std@v6.4.0/bufname/mod.ts";
import { GIN_FILE_BUFFER_PROTOCOLS } from "../global.ts";

export async function expand(denops: Denops, expr: string): Promise<string> {
  const bufname = await fn.expand(denops, expr) as string;
  try {
    const { scheme, fragment } = parseBufname(bufname);
    if (fragment && GIN_FILE_BUFFER_PROTOCOLS.includes(scheme)) {
      try {
        // Return the first path if the buffer has multiple paths
        const paths = JSON.parse(fragment);
        return paths.at(0) ?? bufname;
      } catch {
        return fragment;
      }
    }
  } catch {
    // Ignore errors
  }
  return bufname;
}
