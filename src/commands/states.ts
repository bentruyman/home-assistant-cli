import { command } from "@truyman/cli";

import { buildPayload, createClient, printOutput } from "../lib/runtime.ts";
import { filterByRegex } from "../lib/selectors.ts";
import { parseTimeExpression } from "../lib/parse.ts";
import { GlobalOptions } from "../options.ts";

const entityColumns = [
  { header: "ENTITY", path: "entity_id" },
  { header: "DESCRIPTION", path: "attributes.friendly_name" },
  { header: "STATE", path: "state" },
  { header: "CHANGED", path: "last_changed" },
] as const;

function parseServiceTarget(entities: string[]): Record<string, unknown> {
  return { entity_id: entities };
}

const list = command({
  name: "list",
  description: "List entity states",
  inherits: GlobalOptions,
  args: [{ name: "filter", type: "string", description: "Regex filter", optional: true }] as const,
  handler: async ([filter], options) => {
    const client = createClient(options);
    const states = filterByRegex(await client.getStates(), filter, (item) => item.entity_id ?? "");
    printOutput(states, options, [...entityColumns]);
  },
});

const get = command({
  name: "get",
  description: "Get one entity state",
  inherits: GlobalOptions,
  args: [{ name: "entity", type: "string", description: "Entity ID" }] as const,
  handler: async ([entity], options) => {
    const client = createClient(options);
    const state = await client.getState(entity);
    if (!state) {
      throw new Error(`Entity "${entity}" was not found.`);
    }
    printOutput(state, options, [...entityColumns]);
  },
});

const set = command({
  name: "set",
  description: "Set one entity state",
  inherits: GlobalOptions,
  args: [
    { name: "entity", type: "string", description: "Entity ID" },
    { name: "state", type: "string", description: "State value", optional: true },
  ] as const,
  options: {
    data: {
      type: "string",
      description: "Attributes as key=value pairs",
      placeholder: "pairs",
    },
    json: {
      type: "string",
      description: "JSON payload for the state update",
      placeholder: "json",
    },
    merge: {
      type: "boolean",
      description: "Merge the payload with the current state",
    },
  },
  handler: async ([entity, state], options) => {
    const client = createClient(options);
    let payload = buildPayload(options.data, options.json);

    if (options.merge) {
      const existing = await client.getState(entity);
      if (existing) {
        payload = {
          ...existing,
          ...payload,
          attributes: {
            ...existing.attributes,
            ...(payload.attributes as Record<string, unknown> | undefined),
          },
        };
      }
    }

    if (!options.json) {
      payload = {
        ...payload,
        ...(state ? { state } : {}),
      };
    }

    if (!("state" in payload)) {
      throw new Error("State payload is missing a state value.");
    }

    printOutput(await client.setState(entity, payload), options, [...entityColumns]);
  },
});

const remove = command({
  name: "delete",
  description: "Delete one entity state",
  inherits: GlobalOptions,
  args: [{ name: "entity", type: "string", description: "Entity ID" }] as const,
  handler: async ([entity], options) => {
    const client = createClient(options);
    const deleted = await client.deleteState(entity);
    printOutput(
      {
        entity,
        deleted,
      },
      options,
      [
        { header: "ENTITY", path: "entity" },
        { header: "DELETED", path: "deleted" },
      ],
    );
  },
});

const history = command({
  name: "history",
  description: "Show state history for one or more entities",
  inherits: GlobalOptions,
  args: [
    {
      name: "entities",
      type: "string",
      description: "Entity IDs",
      variadic: true,
    },
  ] as const,
  options: {
    since: {
      type: "string",
      description: "Start time as ISO or relative expression",
      default: "-1d",
    },
    end: {
      type: "string",
      description: "End time as ISO or relative expression",
      default: "0m",
    },
  },
  handler: async ([entities], options) => {
    const client = createClient(options);
    const start = parseTimeExpression(options.since).toISOString();
    const end = parseTimeExpression(options.end).toISOString();
    const history = await client.getHistory(entities, start, end);
    printOutput(history.flat(), options, [...entityColumns]);
  },
});

function stateServiceCommand(name: string, description: string, service: string) {
  return command({
    name,
    description,
    inherits: GlobalOptions,
    args: [
      {
        name: "entities",
        type: "string",
        description: "Entity IDs",
        variadic: true,
      },
    ] as const,
    handler: async ([entities], options) => {
      const client = createClient(options);
      printOutput(
        await client.callService("homeassistant", service, parseServiceTarget(entities)),
        options,
      );
    },
  });
}

const toggle = stateServiceCommand("toggle", "Toggle one or more entities", "toggle");
const on = stateServiceCommand("on", "Turn one or more entities on", "turn_on");
const off = stateServiceCommand("off", "Turn one or more entities off", "turn_off");

export const states = command({
  name: "states",
  description: "Read and update Home Assistant entity states",
  subcommands: [get, history, list, off, on, remove, set, toggle],
});
