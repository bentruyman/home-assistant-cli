import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  clearStoredProfile,
  readStoredProfile,
  writeStoredProfile,
} from "../src/lib/auth-store.ts";
import { AuthStoreError } from "../src/lib/errors.ts";
import { getAuthFilePath } from "../src/lib/paths.ts";

let dataHome: string;
let configHome: string;
let previousDataHome: string | undefined;
let previousConfigHome: string | undefined;

beforeEach(() => {
  const root = mkdtempSync(join(tmpdir(), "hass-auth-"));
  dataHome = join(root, "data");
  configHome = join(root, "config");
  mkdirSync(dataHome, { recursive: true });
  mkdirSync(configHome, { recursive: true });
  previousDataHome = process.env.XDG_DATA_HOME;
  previousConfigHome = process.env.XDG_CONFIG_HOME;
  process.env.XDG_DATA_HOME = dataHome;
  process.env.XDG_CONFIG_HOME = configHome;
});

afterEach(() => {
  if (previousDataHome === undefined) {
    delete process.env.XDG_DATA_HOME;
  } else {
    process.env.XDG_DATA_HOME = previousDataHome;
  }

  if (previousConfigHome === undefined) {
    delete process.env.XDG_CONFIG_HOME;
  } else {
    process.env.XDG_CONFIG_HOME = previousConfigHome;
  }
});

describe("auth store", () => {
  test("writes and reads the stored default profile", () => {
    writeStoredProfile({
      server: "http://example.local:8123",
      token: "abc123",
      updatedAt: "2026-03-10T00:00:00.000Z",
      info: {
        locationName: "Home",
        version: "2026.3.0",
      },
    });

    expect(readStoredProfile()).toEqual({
      server: "http://example.local:8123",
      token: "abc123",
      updatedAt: "2026-03-10T00:00:00.000Z",
      info: {
        locationName: "Home",
        version: "2026.3.0",
      },
    });
  });

  test("removes the stored profile on logout", () => {
    writeStoredProfile({
      server: "http://example.local:8123",
      token: "abc123",
      updatedAt: "2026-03-10T00:00:00.000Z",
    });

    clearStoredProfile();

    expect(readStoredProfile()).toBeNull();
  });

  test("throws a clear error for corrupted auth.json", () => {
    const authPath = getAuthFilePath();
    mkdirSync(join(dataHome, "home-assistant"), { recursive: true });
    writeFileSync(authPath, "{not json}", "utf8");

    expect(() => readStoredProfile()).toThrow(AuthStoreError);
  });
});
