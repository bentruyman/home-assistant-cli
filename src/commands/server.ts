import { command } from "@truyman/cli";

import { createClient, printOutput } from "../lib/runtime.ts";
import { GlobalOptions } from "../options.ts";

const info = command({
  name: "info",
  description: "Show Home Assistant instance info",
  inherits: GlobalOptions,
  handler: async (_, options) => {
    const client = createClient(options);
    const data = await client.getDiscoveryInfo();
    printOutput(data, options, [
      { header: "BASE_URL", path: "base_url" },
      { header: "LOCATION", path: "location_name" },
      { header: "VERSION", path: "version" },
      { header: "REQUIRES_API_PASSWORD", path: "requires_api_password" },
    ]);
  },
});

const config = command({
  name: "config",
  description: "Show full Home Assistant config",
  inherits: GlobalOptions,
  handler: async (_, options) => {
    const client = createClient(options);
    printOutput(await client.getConfig(), options);
  },
});

const components = command({
  name: "components",
  description: "List loaded Home Assistant components",
  inherits: GlobalOptions,
  handler: async (_, options) => {
    const client = createClient(options);
    const config = await client.getConfig();
    printOutput(config.components ?? [], options, [{ header: "COMPONENT", path: "$" }]);
  },
});

const directories = command({
  name: "directories",
  description: "List allowed external directories",
  inherits: GlobalOptions,
  handler: async (_, options) => {
    const client = createClient(options);
    const config = await client.getConfig();
    const directories = config.allowlist_external_dirs ?? config.whitelist_external_dirs ?? [];
    printOutput(directories, options, [{ header: "DIRECTORY", path: "$" }]);
  },
});

const health = command({
  name: "health",
  description: "Show Home Assistant system health",
  inherits: GlobalOptions,
  handler: async (_, options) => {
    const client = createClient(options);
    printOutput(await client.getHealth(), options);
  },
});

const logs = command({
  name: "logs",
  description: "Print the Home Assistant error log",
  inherits: GlobalOptions,
  handler: async (_, options) => {
    const client = createClient(options);
    printOutput(await client.getErrorLog(), options);
  },
});

export const server = command({
  name: "server",
  description: "Inspect the connected Home Assistant instance",
  subcommands: [components, config, directories, health, info, logs],
});
