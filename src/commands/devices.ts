import { command } from "@truyman/cli";

import { createClient, printOutput } from "../lib/runtime.ts";
import { dedupeBy, filterByRegex, findByIdOrName } from "../lib/selectors.ts";
import { GlobalOptions } from "../options.ts";

const deviceColumns = [
  { header: "ID", path: "id" },
  { header: "NAME", path: "name" },
  { header: "MODEL", path: "model" },
  { header: "MANUFACTURER", path: "manufacturer" },
  { header: "AREA", path: "area_name" },
] as const;

async function getDevicesWithAreas(client: ReturnType<typeof createClient>) {
  const [areas, devices] = await Promise.all([client.getAreas(), client.getDevices()]);
  return devices.map<Record<string, any>>((device) => ({
    ...device,
    area_name: areas.find((area) => area.area_id === device.area_id)?.name,
  }));
}

async function resolveDevice(client: ReturnType<typeof createClient>, value: string) {
  const devices = await client.getDevices();
  const device = findByIdOrName(devices, value, "id", "name");
  if (!device) {
    throw new Error(`Device "${value}" was not found.`);
  }
  return device;
}

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
  description: "List Home Assistant devices",
  inherits: GlobalOptions,
  args: [{ name: "filter", type: "string", description: "Regex filter", optional: true }] as const,
  handler: async ([filter], options) => {
    const client = createClient(options);
    const devices = filterByRegex(
      await getDevicesWithAreas(client),
      filter,
      (item) => item.name ?? "",
    );
    printOutput(devices, options, [...deviceColumns]);
  },
});

const rename = command({
  name: "rename",
  description: "Rename a device",
  inherits: GlobalOptions,
  args: [
    { name: "device", type: "string", description: "Device ID or name" },
    { name: "name", type: "string", description: "New device name" },
  ] as const,
  handler: async ([deviceValue, name], options) => {
    const client = createClient(options);
    const device = await resolveDevice(client, deviceValue);
    printOutput(await client.renameDevice(device.id, name), options);
  },
});

const assignArea = command({
  name: "assign-area",
  description: "Assign devices to an area",
  inherits: GlobalOptions,
  args: [
    { name: "area", type: "string", description: "Area ID or name" },
    {
      name: "devices",
      type: "string",
      description: "Device IDs or names",
      optional: true,
      variadic: true,
    },
  ] as const,
  options: {
    match: {
      type: "string",
      description: "Regex to select devices by name",
      placeholder: "regex",
    },
  },
  handler: async ([areaValue, deviceValues], options) => {
    const client = createClient(options);
    const area = await resolveArea(client, areaValue);
    const allDevices = await client.getDevices();
    const matched = options.match
      ? filterByRegex(allDevices, options.match, (item) => item.name ?? "")
      : [];
    const explicit = deviceValues.map((value) => {
      const device = findByIdOrName(allDevices, value, "id", "name");
      if (!device) {
        throw new Error(`Device "${value}" was not found.`);
      }
      return device;
    });

    const selected = dedupeBy([...matched, ...explicit], (item) => item.id);
    const results = [];
    for (const device of selected) {
      results.push(await client.assignDeviceArea(device.id, area.area_id));
    }
    printOutput(results, options);
  },
});

export const devices = command({
  name: "devices",
  description: "List and update Home Assistant devices",
  subcommands: [assignArea, list, rename],
});
