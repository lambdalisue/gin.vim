#!/usr/bin/env -S deno run --no-check --allow-env=GIN_PROXY_ADDRESS --allow-net=127.0.0.1
import * as streams from "https://deno.land/std@0.150.0/streams/mod.ts";

const resultPattern = /^([^:]+):(.*)$/;

const addr = JSON.parse(Deno.env.get("GIN_PROXY_ADDRESS") ?? "null");
if (!addr) {
  throw new Error("GIN_PROXY_ADDRESS environment variable is required");
}

const prompt = Deno.args[0];
if (!prompt) {
  throw new Error("No prompt is specified to the askpass");
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const conn = await Deno.connect(addr);
await streams.writeAll(conn, encoder.encode(`askpass:${prompt}`));
await conn.closeWrite();
const result = decoder.decode(await streams.readAll(conn));
conn.close();

const m = result.match(resultPattern);
if (!m) {
  throw new Error(`Unexpected result '${result}' is received`);
}

const [status, value] = m.slice(1);
switch (status) {
  case "ok":
    console.log(value);
    Deno.exit(0);
    /* fall through */
  case "err":
    console.error(value);
    Deno.exit(1);
    /* fall through */
  default:
    throw new Error(`Unexpected status '${status}' is received`);
}
