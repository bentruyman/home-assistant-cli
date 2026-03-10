import { command } from "@truyman/cli";

import { createClient, printOutput } from "../lib/runtime.ts";
import { dedupeBy, filterByRegex, findByIdOrName } from "../lib/selectors.ts";
import { GlobalOptions } from "../options.ts";

const entityColumns = [
  { header: "ENTITY_ID", path: "entity_id" },
  { header: "NAME", path: "name" },
  { header: "DEVICE_ID", path: "device_id" },
  { header: "PLATFORM", path: "platform" },
  { header: "AREA", path: "area_name" },
  { header: "CONFIG_ENTRY_ID", path: "config_entry_id" },
  { header: "DISABLED_BY", path: "disabled_by" },
] as const;

async function getEntitiesWithAreas(client: ReturnType<typeof createClient>) {
  const [areas, entities] = await Promise.all([client.getAreas(), client.getEntities()]);
  return entities.map<Record<string, any>>((entity) => ({
    ...entity,
    area_name: areas.find((area) => area.area_id === entity.area_id)?.name,
  }));
}

async function resolveArea(client: ReturnType<typeof createClient>, value: string) {
  const areas = await client.getAreas();
  const area = findByIdOrName(areas, value, "area_id", "name");
  if (!area) {
    throw new Error(`Area "${value}" was not found.`);
  }
  return area;
}

async function resolveEntity(client: ReturnType<typeof createClient>, value: string) {
  const entities = await client.getEntities();
  const entity = findByIdOrName(entities, value, "entity_id", "name");
  if (!entity) {
    throw new Error(`Entity "${value}" was not found.`);
  }
  return entity;
}

const list = command({
  name: "list",
  description: "List Home Assistant registry entities",
  inherits: GlobalOptions,
  args: [{ name: "filter", type: "string", description: "Regex filter", optional: true }] as const,
  handler: async ([filter], options) => {
    const client = createClient(options);
    const entities = filterByRegex(
      await getEntitiesWithAreas(client),
      filter,
      (item) => item.entity_id ?? "",
    );
    printOutput(entities, options, [...entityColumns]);
  },
});

const rename = command({
  name: "rename",
  description: "Rename an entity registry entry",
  inherits: GlobalOptions,
  args: [
    { name: "entity", type: "string", description: "Entity ID" },
    { name: "newId", type: "string", description: "New entity ID", optional: true },
  ] as const,
  options: {
    name: {
      type: "string",
      description: "New friendly name",
      placeholder: "name",
    },
  },
  handler: async ([entity, newId], options) => {
    if (!newId && !options.name) {
      throw new Error("Provide a new entity ID, --name, or both.");
    }

    const client = createClient(options);
    const existing = await resolveEntity(client, entity);
    printOutput(await client.renameEntity(existing.entity_id, newId, options.name), options);
  },
});

const assignArea = command({
  name: "assign-area",
  description: "Assign entities to an area",
  inherits: GlobalOptions,
  args: [
    { name: "area", type: "string", description: "Area ID or name" },
    {
      name: "entities",
      type: "string",
      description: "Entity IDs or names",
      optional: true,
      variadic: true,
    },
  ] as const,
  options: {
    match: {
      type: "string",
      description: "Regex to select entities by name",
      placeholder: "regex",
    },
  },
  handler: async ([areaValue, entityValues], options) => {
    const client = createClient(options);
    const area = await resolveArea(client, areaValue);
    const allEntities = await client.getEntities();
    const matched = options.match
      ? filterByRegex(allEntities, options.match, (item) => item.name ?? "")
      : [];
    const explicit = entityValues.map((value) => {
      const entity = findByIdOrName(allEntities, value, "entity_id", "name");
      if (!entity) {
        throw new Error(`Entity "${value}" was not found.`);
      }
      return entity;
    });

    const selected = dedupeBy([...matched, ...explicit], (item) => item.entity_id);
    const results = [];
    for (const entity of selected) {
      results.push(await client.assignEntityArea(entity.entity_id, area.area_id));
    }
    printOutput(results, options);
  },
});

export const entities = command({
  name: "entities",
  description: "List and update Home Assistant entity registry entries",
  subcommands: [assignArea, list, rename],
});
