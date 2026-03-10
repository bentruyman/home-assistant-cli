import { readFileSync } from "node:fs";

import kleur from "kleur";

import { readStoredProfile } from "./auth-store.ts";
import { DEFAULT_SERVER } from "./constants.ts";
import { AuthStoreError } from "./errors.ts";
import { HomeAssistantClient, type ConnectionConfig } from "./home-assistant.ts";
import { formatOutput } from "./output.ts";
import { mergeInputData } from "./parse.ts";
import { stripWrappingQuotes } from "./strings.ts";

export interface GlobalOptionValues {
  verbose: boolean;
  server?: string;
  token?: string;
  timeout?: number;
  insecure: boolean;
  output?: string;
  columns?: string;
  noHeaders?: boolean;
  sortBy?: string;
  tableFormat?: string;
}

export interface ResolvedConnection extends ConnectionConfig {
  source: "flags" | "env" | "store" | "default";
  hasStoredProfile: boolean;
  storedProfilePath?: string;
}

export function resolveConnection(options: GlobalOptionValues): ResolvedConnection {
  let storedProfile = null;

  try {
    storedProfile = readStoredProfile();
  } catch (error) {
    if (!(error instanceof AuthStoreError)) {
      throw error;
    }

    if (options.verbose) {
      console.error(kleur.yellow(error.message));
    }
  }

  const envServer = process.env.HASS_SERVER;
  const envToken = process.env.HASS_TOKEN;
  const envTimeout = process.env.HASS_TIMEOUT ? Number(process.env.HASS_TIMEOUT) : undefined;
  const envInsecure = process.env.HASS_INSECURE
    ? ["1", "true", "yes"].includes(process.env.HASS_INSECURE.toLowerCase())
    : undefined;

  let source: ResolvedConnection["source"] = "default";
  if (storedProfile) {
    source = "store";
  }
  if (envServer || envToken || envTimeout !== undefined || envInsecure !== undefined) {
    source = "env";
  }
  if (options.server || options.token) {
    source = "flags";
  }

  return {
    server:
      stripWrappingQuotes(options.server || envServer || storedProfile?.server) || DEFAULT_SERVER,
    token: stripWrappingQuotes(options.token || envToken || storedProfile?.token),
    timeoutSeconds: options.timeout ?? envTimeout ?? 10,
    insecure: options.insecure || envInsecure || storedProfile?.insecure || false,
    verbose: options.verbose,
    source,
    hasStoredProfile: Boolean(storedProfile),
  };
}

export function createClient(options: GlobalOptionValues): HomeAssistantClient {
  return new HomeAssistantClient(resolveConnection(options));
}

export function printOutput(
  data: unknown,
  options: GlobalOptionValues,
  defaultColumns?: { header: string; path: string }[],
): void {
  console.log(formatOutput(data, options, defaultColumns));
}

export function readInputFile(path: string): string {
  return readFileSync(path, "utf8");
}

export function buildPayload(data?: string, json?: string): Record<string, unknown> {
  return mergeInputData(data, json);
}
