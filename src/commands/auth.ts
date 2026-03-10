import { command } from "@truyman/cli";
import { createInterface } from "node:readline/promises";

import { clearStoredProfile, readStoredProfile, writeStoredProfile } from "../lib/auth-store.ts";
import { HttpError } from "../lib/errors.ts";
import { getAuthFilePath } from "../lib/paths.ts";
import { createClient, printOutput, resolveConnection } from "../lib/runtime.ts";
import { stripWrappingQuotes } from "../lib/strings.ts";
import { GlobalOptions } from "../options.ts";

async function prompt(question: string): Promise<string> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    return (await readline.question(question)).trim();
  } finally {
    readline.close();
  }
}

const login = command({
  name: "login",
  description: "Store a default Home Assistant server and token",
  inherits: GlobalOptions,
  handler: async (_, options) => {
    const server = stripWrappingQuotes(options.server || (await prompt("Home Assistant URL: ")));
    const token = stripWrappingQuotes(options.token || (await prompt("Long-lived access token: ")));
    if (!server || !token) {
      throw new Error("Both server URL and token are required.");
    }
    const client = createClient({
      ...options,
      server,
      token,
    });

    try {
      await client.validate();
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        throw new Error(
          `Home Assistant rejected the token at ${server}/api/. Verify the exact base URL and, if this host is behind a reverse proxy, that it forwards the Authorization header.`,
        );
      }
      throw error;
    }

    let info: Record<string, unknown> | undefined;
    try {
      info = await client.getDiscoveryInfo();
    } catch {
      info = undefined;
    }

    writeStoredProfile({
      server,
      token,
      insecure: options.insecure,
      updatedAt: new Date().toISOString(),
      info: info
        ? {
            baseUrl: typeof info.base_url === "string" ? info.base_url : undefined,
            locationName: typeof info.location_name === "string" ? info.location_name : undefined,
            version: typeof info.version === "string" ? info.version : undefined,
          }
        : undefined,
    });

    printOutput(
      {
        configured: true,
        server,
        auth_file: getAuthFilePath(),
        location_name: info?.location_name,
        version: info?.version,
      },
      options,
      [
        { header: "CONFIGURED", path: "configured" },
        { header: "SERVER", path: "server" },
        { header: "LOCATION", path: "location_name" },
        { header: "VERSION", path: "version" },
        { header: "AUTH_FILE", path: "auth_file" },
      ],
    );
  },
});

const status = command({
  name: "status",
  description: "Show current Home Assistant auth status",
  inherits: GlobalOptions,
  handler: async (_, options) => {
    const resolved = resolveConnection(options);
    let stored = null;
    try {
      stored = readStoredProfile();
    } catch (error) {
      stored = null;
      if (options.verbose && error instanceof Error) {
        console.error(error.message);
      }
    }
    const result: Record<string, unknown> = {
      configured: Boolean(resolved.token),
      server: resolved.server,
      source: resolved.source,
      insecure: resolved.insecure,
      auth_file: getAuthFilePath(),
      stored_server: stored?.server,
    };

    if (resolved.token) {
      try {
        const client = createClient(options);
        await client.validate();
        const info = (await client.getDiscoveryInfo().catch(() => ({}))) as Record<string, unknown>;
        result.valid = true;
        result.location_name = info.location_name;
        result.version = info.version;
      } catch (error) {
        result.valid = false;
        result.error = error instanceof Error ? error.message : String(error);
      }
    }

    printOutput(result, options, [
      { header: "CONFIGURED", path: "configured" },
      { header: "VALID", path: "valid" },
      { header: "SERVER", path: "server" },
      { header: "SOURCE", path: "source" },
      { header: "LOCATION", path: "location_name" },
      { header: "VERSION", path: "version" },
      { header: "AUTH_FILE", path: "auth_file" },
      { header: "ERROR", path: "error" },
    ]);
  },
});

const logout = command({
  name: "logout",
  description: "Remove the stored default Home Assistant auth profile",
  inherits: GlobalOptions,
  handler: (_, options) => {
    clearStoredProfile();
    printOutput(
      {
        configured: false,
        auth_file: getAuthFilePath(),
      },
      options,
      [
        { header: "CONFIGURED", path: "configured" },
        { header: "AUTH_FILE", path: "auth_file" },
      ],
    );
  },
});

export const auth = command({
  name: "auth",
  description: "Manage stored Home Assistant credentials",
  subcommands: [login, logout, status],
});
