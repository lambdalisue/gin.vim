import type { Denops } from "https://deno.land/x/denops_std@v6.4.0/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v6.4.0/function/mod.ts";
import { v } from "https://deno.land/x/denops_std@v6.4.0/variable/mod.ts";

export async function yank(
  denops: Denops,
  value: string,
  reg?: string,
): Promise<void> {
  reg = reg ?? await v.get(denops, "register");
  await fn.setreg(denops, reg, value);
}
