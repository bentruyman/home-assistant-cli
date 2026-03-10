import { command } from "@truyman/cli";

import { createClient, printOutput } from "../lib/runtime.ts";
import { filterByRegex, findByIdOrName } from "../lib/selectors.ts";
import { GlobalOptions } from "../options.ts";

const areaColumns = [
  { header: "ID", path: "area_id" },
  { header: "NAME", path: "name" },
] as const;

async function resolveArea(client: ReturnType<typeof createClient>, value: string) {
  const areas = await client.getAreas();
  const area = findByIdOrName(areas, value, "area_id", "name");
  if (!area) {
    throw new Error(`Area "${value}" was not found.`);
  }
  return area;
}

const list = command({
  name: "list",
  description: "List Home Assistant areas",
  inherits: GlobalOptions,
  args: [{ name: "filter", type: "string", description: "Regex filter", optional: true }] as const,
  handler: async ([filter], options) => {
    const client = createClient(options);
    printOutput(
      filterByRegex(await client.getAreas(), filter, (item) => item.name ?? ""),
      options,
      [...areaColumns],
    );
  },
});

const create = command({
  name: "create",
  description: "Create one or more areas",
  inherits: GlobalOptions,
  args: [
    {
      name: "names",
      type: "string",
      description: "Area names",
      variadic: true,
    },
  ] as const,
  handler: async ([names], options) => {
    const client = createClient(options);
    const results = [];
    for (const name of names) {
      results.push(await client.createArea(name));
    }
    printOutput(results, options, [...areaColumns]);
  },
});

const remove = command({
  name: "delete",
  description: "Delete one or more areas",
  inherits: GlobalOptions,
  args: [
    {
      name: "areas",
      type: "string",
      description: "Area IDs or names",
      variadic: true,
    },
  ] as const,
  handler: async ([areas], options) => {
    const client = createClient(options);
    const results = [];
    for (const value of areas) {
      const area = await resolveArea(client, value);
      results.push(await client.deleteArea(area.area_id));
    }
    printOutput(results, options);
  },
});

const rename = command({
  name: "rename",
  description: "Rename an area",
  inherits: GlobalOptions,
  args: [
    { name: "area", type: "string", description: "Area ID or name" },
    { name: "name", type: "string", description: "New area name" },
  ] as const,
  handler: async ([areaValue, name], options) => {
    const client = createClient(options);
    const area = await resolveArea(client, areaValue);
    printOutput(await client.renameArea(area.area_id, name), options);
  },
});

export const areas = command({
  name: "areas",
  description: "List and update Home Assistant areas",
  subcommands: [create, list, remove, rename],
});
