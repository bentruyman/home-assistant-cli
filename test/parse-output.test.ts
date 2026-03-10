import { describe, expect, test } from "bun:test";

import { formatOutput } from "../src/lib/output.ts";
import {
  getPathValues,
  parseColumns,
  parseKeyValueInput,
  parseTimeExpression,
} from "../src/lib/parse.ts";

describe("parse helpers", () => {
  test("parses key/value pairs and custom columns", () => {
    expect(parseKeyValueInput("entity_id=light.kitchen,brightness=120,enabled=true")).toEqual({
      entity_id: "light.kitchen",
      brightness: 120,
      enabled: true,
    });

    expect(parseColumns("ENTITY=entity_id,STATE=state")).toEqual([
      { header: "ENTITY", path: "entity_id" },
      { header: "STATE", path: "state" },
    ]);
  });

  test("reads dotted paths and relative time expressions", () => {
    const data = {
      entity_id: "light.kitchen",
      attributes: {
        friendly_name: "Kitchen Light",
      },
    };

    expect(getPathValues(data, "attributes.friendly_name")).toEqual(["Kitchen Light"]);
    expect(parseTimeExpression("-2h", new Date("2026-03-10T12:00:00.000Z")).toISOString()).toBe(
      "2026-03-10T10:00:00.000Z",
    );
  });
});

describe("output formatting", () => {
  const rows = [
    {
      entity_id: "sensor.two",
      state: "off",
      attributes: {
        friendly_name: "Two",
      },
    },
    {
      entity_id: "sensor.one",
      state: "on",
      attributes: {
        friendly_name: "One",
      },
    },
  ];

  const columns = [
    { header: "ENTITY", path: "entity_id" },
    { header: "NAME", path: "attributes.friendly_name" },
    { header: "STATE", path: "state" },
  ];

  test("renders sorted tables", () => {
    const output = formatOutput(
      rows,
      {
        output: "table",
        sortBy: "entity_id",
      },
      columns,
    );

    expect(output).toContain("ENTITY");
    expect(output.indexOf("sensor.one")).toBeLessThan(output.indexOf("sensor.two"));
  });

  test("renders json, yaml, and ndjson", () => {
    expect(formatOutput(rows, { output: "json" })).toContain('"entity_id": "sensor.two"');
    expect(formatOutput(rows, { output: "yaml" })).toContain("entity_id: sensor.two");
    expect(formatOutput(rows, { output: "ndjson" }).split("\n")).toHaveLength(2);
  });
});
