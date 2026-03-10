import { homedir } from "node:os";
import { join } from "node:path";

import { xdgConfig, xdgData } from "xdg-basedir";

function fallbackDir(...segments: string[]): string {
  return join(homedir(), ...segments);
}

export function getDataDir(): string {
  return process.env.XDG_DATA_HOME || xdgData || fallbackDir(".local", "share");
}

export function getConfigDir(): string {
  return process.env.XDG_CONFIG_HOME || xdgConfig || fallbackDir(".config");
}

export function getAppDataDir(): string {
  return join(getDataDir(), "home-assistant");
}

export function getAppConfigDir(): string {
  return join(getConfigDir(), "home-assistant");
}

export function getAuthFilePath(): string {
  return join(getAppDataDir(), "auth.json");
}
