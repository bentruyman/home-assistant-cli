import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { HomeAssistantClient } from "../src/lib/home-assistant.ts";

class FakeWebSocket {
  static OPEN = 1;

  readyState = 1;
  sent: string[] = [];
  listeners = new Map<string, Set<(event?: any) => void>>();

  constructor(
    readonly url: string,
    readonly _protocols?: string | string[],
    readonly _options?: Record<string, unknown>,
  ) {
    queueMicrotask(() => {
      this.emit("open");
      queueMicrotask(() => {
        this.emit("message", { data: JSON.stringify({ type: "auth_required" }) });
      });
    });
  }

  addEventListener(type: string, handler: (event?: any) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, handler: (event?: any) => void): void {
    this.listeners.get(type)?.delete(handler);
  }

  send(data: string): void {
    this.sent.push(data);
    const parsed = JSON.parse(data) as Record<string, any>;

    queueMicrotask(() => {
      if (parsed.type === "auth") {
        this.emit("message", { data: JSON.stringify({ type: "auth_ok" }) });
        return;
      }

      this.emit("message", {
        data: JSON.stringify({
          id: parsed.id,
          type: "result",
          success: true,
          result:
            parsed.type === "config/area_registry/list"
              ? [{ area_id: "kitchen", name: "Kitchen" }]
              : { ok: true },
        }),
      });
    });
  }

  close(): void {
    this.emit("close");
  }

  private emit(type: string, event?: any): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

describe("HomeAssistantClient", () => {
  const originalFetch = globalThis.fetch;
  const originalWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/")) {
        return new Response(JSON.stringify({ message: "API running." }), { status: 200 });
      }

      if (url.endsWith("/api/states")) {
        return new Response(
          JSON.stringify([
            { entity_id: "light.kitchen", state: "on" },
            { entity_id: "light.office", state: "off" },
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

      return new Response(JSON.stringify({ url }), { status: 200 });
    }) as typeof fetch;

    globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.WebSocket = originalWebSocket;
  });

  test("calls REST endpoints", async () => {
    const client = new HomeAssistantClient({
      server: "http://ha.local:8123",
      token: "abc",
      timeoutSeconds: 10,
      insecure: false,
      verbose: false,
    });

    expect(await client.validate()).toEqual({ message: "API running." });
    expect(await client.getStates()).toHaveLength(2);
    expect(await client.callService("light", "turn_on", { entity_id: "light.kitchen" })).toEqual([
      { entity_id: "light.kitchen", state: "on" },
    ]);
  });

  test("calls websocket registry endpoints", async () => {
    const client = new HomeAssistantClient({
      server: "http://ha.local:8123",
      token: "abc",
      timeoutSeconds: 10,
      insecure: false,
      verbose: false,
    });

    expect(await client.getAreas()).toEqual([{ area_id: "kitchen", name: "Kitchen" }]);
  });
});
