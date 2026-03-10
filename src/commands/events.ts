import { command } from "@truyman/cli";

import { buildPayload, createClient, printOutput } from "../lib/runtime.ts";
import { GlobalOptions } from "../options.ts";

const list = command({
  name: "list",
  description: "List available Home Assistant events",
  inherits: GlobalOptions,
  handler: async (_, options) => {
    const client = createClient(options);
    printOutput(await client.getEvents(), options, [
      { header: "EVENT", path: "event" },
      { header: "LISTENER_COUNT", path: "listener_count" },
    ]);
  },
});

const fire = command({
  name: "fire",
  description: "Fire a Home Assistant event",
  inherits: GlobalOptions,
  args: [{ name: "event", type: "string", description: "Event type" }] as const,
  options: {
    data: {
      type: "string",
      description: "Event data as key=value pairs",
      placeholder: "pairs",
    },
    json: {
      type: "string",
      description: "JSON payload for the event",
      placeholder: "json",
    },
  },
  handler: async ([event], options) => {
    const client = createClient(options);
    printOutput(await client.fireEvent(event, buildPayload(options.data, options.json)), options);
  },
});

const watch = command({
  name: "watch",
  description: "Subscribe to Home Assistant events",
  inherits: GlobalOptions,
  args: [{ name: "event", type: "string", description: "Event type", optional: true }] as const,
  handler: async ([event], options) => {
    const client = createClient(options);

    process.once("SIGINT", () => {
      process.exit(0);
    });

    await client.watchEvents(event, (message) => {
      printOutput(message.event ?? message, options, [
        { header: "EVENT", path: "event_type" },
        { header: "DATA", path: "data" },
        { header: "TIME", path: "time_fired" },
      ]);
    });
  },
});

export const events = command({
  name: "events",
  description: "List, fire, and watch Home Assistant events",
  subcommands: [fire, list, watch],
});
