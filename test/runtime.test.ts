import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { writeStoredProfile } from "../src/lib/auth-store.ts";
import { resolveConnection } from "../src/lib/runtime.ts";

let dataHome: string;
let configHome: string;
let envSnapshot: NodeJS.ProcessEnv;

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "hass-runtime-"));
  dataHome = join(root, "data");
  configHome = join(root, "config");
  mkdirSync(dataHome, { recursive: true });
  mkdirSync(configHome, { recursive: true });
  envSnapshot = { ...process.env };
  process.env.XDG_DATA_HOME = dataHome;
  process.env.XDG_CONFIG_HOME = configHome;
  delete process.env.HASS_SERVER;
  delete process.env.HASS_TOKEN;
  delete process.env.HASS_TIMEOUT;
  delete process.env.HASS_INSECURE;
});

afterEach(() => {
  process.env = envSnapshot;
});

describe("resolveConnection", () => {
  test("uses the stored profile when flags and env are absent", () => {
    writeStoredProfile({
      server: "http://stored.local:8123",
      token: "stored-token",
      insecure: true,
      updatedAt: "2026-03-10T00:00:00.000Z",
    });

    const resolved = resolveConnection({
      verbose: false,
      insecure: false,
    });

    expect(resolved.server).toBe("http://stored.local:8123");
    expect(resolved.token).toBe("stored-token");
    expect(resolved.insecure).toBe(true);
    expect(resolved.source).toBe("store");
  });

  test("prefers env over stored config and flags over env", () => {
    writeStoredProfile({
      server: "http://stored.local:8123",
      token: "stored-token",
      updatedAt: "2026-03-10T00:00:00.000Z",
    });
    process.env.HASS_SERVER = "http://env.local:8123";
    process.env.HASS_TOKEN = "env-token";
    process.env.HASS_TIMEOUT = "15";

    const envResolved = resolveConnection({
      verbose: false,
      insecure: false,
    });
    expect(envResolved.server).toBe("http://env.local:8123");
    expect(envResolved.token).toBe("env-token");
    expect(envResolved.timeoutSeconds).toBe(15);
    expect(envResolved.source).toBe("env");

    const flagResolved = resolveConnection({
      verbose: false,
      insecure: false,
      server: '"http://flag.local:8123"',
      token: '"flag-token"',
      timeout: 20,
    });
    expect(flagResolved.server).toBe("http://flag.local:8123");
    expect(flagResolved.token).toBe("flag-token");
    expect(flagResolved.timeoutSeconds).toBe(20);
    expect(flagResolved.source).toBe("flags");
  });
});
