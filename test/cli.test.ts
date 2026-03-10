import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { hass } from "../src/cli.ts";

function captureConsole() {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;

  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  };

  return {
    logs,
    errors,
    restore() {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

describe("CLI", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = (async (input, init) => {
      const url = String(input);

      if (url.endsWith("/api/states")) {
        return new Response(
          JSON.stringify([
            {
              entity_id: "sensor.one",
              state: "on",
              attributes: { friendly_name: "One" },
            },
            {
              entity_id: "sensor.two",
              state: "off",
              attributes: { friendly_name: "Two" },
            },
          ]),
          { status: 200 },
        );
      }

      if (url.includes("/api/services/light/turn_on")) {
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify([{ entity_id: "light.kitchen", state: "on" }]), {
          status: 200,
        });
      }

      if (url.endsWith("/api/discovery_info")) {
        return new Response(
          JSON.stringify({
            base_url: "http://ha.local:8123",
            location_name: "Home",
            version: "2026.3.0",
          }),
          { status: 200 },
        );
      }

      if (url.endsWith("/api/")) {
        return new Response(JSON.stringify({ message: "API running." }), { status: 200 });
      }

      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("prints help from the root command", () => {
    expect(hass.help()).toContain("states");
    expect(hass.help()).toContain("services");
    expect(hass.help()).toContain("auth");
  });

  test("runs states list with JSON output", async () => {
    const output = captureConsole();

    try {
      await hass.run([
        "--server",
        "http://ha.local:8123",
        "--token",
        "abc",
        "--output",
        "json",
        "states",
        "list",
        "sensor\\.",
      ]);
    } finally {
      output.restore();
    }

    expect(JSON.parse(output.logs[0] ?? "[]")).toEqual([
      {
        entity_id: "sensor.one",
        state: "on",
        attributes: { friendly_name: "One" },
      },
      {
        entity_id: "sensor.two",
        state: "off",
        attributes: { friendly_name: "Two" },
      },
    ]);
  });

  test("runs services call with key/value data", async () => {
    const output = captureConsole();

    try {
      await hass.run([
        "--server",
        "http://ha.local:8123",
        "--token",
        "abc",
        "--output",
        "json",
        "services",
        "call",
        "light.turn_on",
        "--data",
        "entity_id=light.kitchen",
      ]);
    } finally {
      output.restore();
    }

    expect(JSON.parse(output.logs[0] ?? "[]")).toEqual([
      { entity_id: "light.kitchen", state: "on" },
    ]);
  });
});
