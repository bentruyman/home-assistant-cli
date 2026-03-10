import { command } from "@truyman/cli";

import { buildPayload, createClient, printOutput } from "../lib/runtime.ts";
import { GlobalOptions } from "../options.ts";

function normalizeApiPath(path: string): string {
  if (path.startsWith("/")) {
    return path;
  }

  if (path.startsWith("api/")) {
    return `/${path}`;
  }

  return `/api/${path}`;
}

const get = command({
  name: "get",
  description: "Send a raw GET request to the Home Assistant API",
  inherits: GlobalOptions,
  args: [{ name: "path", type: "string", description: "API path" }] as const,
  handler: async ([path], options) => {
    const client = createClient(options);
    printOutput(await client.rawGet(normalizeApiPath(path)), options);
  },
});

const post = command({
  name: "post",
  description: "Send a raw POST request to the Home Assistant API",
  inherits: GlobalOptions,
  args: [{ name: "path", type: "string", description: "API path" }] as const,
  options: {
    data: {
      type: "string",
      description: "Payload as key=value pairs",
      placeholder: "pairs",
    },
    json: {
      type: "string",
      description: "Payload as JSON",
      placeholder: "json",
    },
  },
  handler: async ([path], options) => {
    const client = createClient(options);
    printOutput(
      await client.rawPost(normalizeApiPath(path), buildPayload(options.data, options.json)),
      options,
    );
  },
});

const ws = command({
  name: "ws",
  description: "Send a raw websocket command to Home Assistant",
  inherits: GlobalOptions,
  args: [{ name: "type", type: "string", description: "WebSocket command type" }] as const,
  options: {
    data: {
      type: "string",
      description: "Frame data as key=value pairs",
      placeholder: "pairs",
    },
    json: {
      type: "string",
      description: "Frame data as JSON",
      placeholder: "json",
    },
  },
  handler: async ([type], options) => {
    const client = createClient(options);
    printOutput(await client.rawWs(type, buildPayload(options.data, options.json)), options);
  },
});

export const api = command({
  name: "api",
  description: "Advanced raw Home Assistant REST and websocket access",
  subcommands: [get, post, ws],
});
