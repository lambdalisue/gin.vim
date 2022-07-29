import type { Denops } from "https://deno.land/x/denops_std@v3.5.0/mod.ts";
import { listen } from "./server.ts";

export function main(denops: Denops): void {
  listen(denops).catch((e) =>
    console.error(`Unexpected error occured in the proxy server: ${e}`)
  );
}
