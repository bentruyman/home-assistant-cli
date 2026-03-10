import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

import { AuthStoreError } from "./errors.ts";
import { getAppConfigDir, getAppDataDir, getAuthFilePath } from "./paths.ts";

export interface StoredProfileInfo {
  baseUrl?: string;
  locationName?: string;
  version?: string;
}

export interface StoredProfile {
  server: string;
  token: string;
  insecure?: boolean;
  updatedAt: string;
  info?: StoredProfileInfo;
}

export function ensureAppDirs(): void {
  mkdirSync(getAppDataDir(), { recursive: true });
  mkdirSync(getAppConfigDir(), { recursive: true });
}

export function readStoredProfile(): StoredProfile | null {
  const file = getAuthFilePath();
  if (!existsSync(file)) {
    return null;
  }

  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as StoredProfile;

    if (!parsed.server || !parsed.token) {
      throw new AuthStoreError("Stored auth file is missing required fields.");
    }

    return parsed;
  } catch (error) {
    if (error instanceof AuthStoreError) {
      throw error;
    }

    throw new AuthStoreError(
      `Stored auth file at ${file} is invalid. Run "hass auth login" to replace it.`,
    );
  }
}

export function writeStoredProfile(profile: StoredProfile): void {
  ensureAppDirs();
  writeFileSync(getAuthFilePath(), `${JSON.stringify(profile, null, 2)}\n`, "utf8");
}

export function clearStoredProfile(): void {
  rmSync(getAuthFilePath(), { force: true });
}
