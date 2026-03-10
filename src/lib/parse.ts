export interface ColumnSpec {
  header: string;
  path: string;
}

function splitRespectingQuotes(input: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;

  for (const char of input) {
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      continue;
    }

    if (quote && char === quote) {
      quote = null;
      continue;
    }

    if (!quote && char === ",") {
      if (current.trim()) {
        parts.push(current.trim());
      }
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

export function coerceScalar(value: string): unknown {
  const trimmed = value.trim();

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  if (trimmed === "null") {
    return null;
  }

  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return Number(trimmed);
  }

  return trimmed;
}

export function parseKeyValueInput(input?: string): Record<string, unknown> {
  if (!input) {
    return {};
  }

  const output: Record<string, unknown> = {};

  for (const entry of splitRespectingQuotes(input)) {
    const separator = entry.indexOf("=");
    if (separator === -1) {
      throw new Error(`Expected key=value pair, received "${entry}"`);
    }

    const key = entry.slice(0, separator).trim();
    const value = entry.slice(separator + 1);
    output[key] = coerceScalar(value);
  }

  return output;
}

export function parseColumns(input?: string): ColumnSpec[] {
  if (!input) {
    return [];
  }

  return splitRespectingQuotes(input).map((entry) => {
    const separator = entry.indexOf("=");
    if (separator === -1) {
      return {
        header: entry.trim(),
        path: entry.trim(),
      };
    }

    return {
      header: entry.slice(0, separator).trim(),
      path: entry.slice(separator + 1).trim(),
    };
  });
}

function splitPath(path: string): string[] {
  const trimmed = path.replace(/^\$\./, "").replace(/^\$/, "");
  if (!trimmed) {
    return [];
  }

  return trimmed.split(".");
}

function flatten(values: unknown[]): unknown[] {
  return values.flatMap((value) => {
    if (Array.isArray(value)) {
      return flatten(value);
    }

    return [value];
  });
}

export function getPathValues(source: unknown, path: string): unknown[] {
  if (path === "$" || path === "") {
    return [source];
  }

  let current: unknown[] = [source];

  for (const rawSegment of splitPath(path)) {
    const wildcard = rawSegment.endsWith("[*]");
    const segment = wildcard ? rawSegment.slice(0, -3) : rawSegment;
    const next: unknown[] = [];

    for (const value of current) {
      if (segment === "*" && Array.isArray(value)) {
        next.push(...value);
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          if (item && typeof item === "object" && segment in item) {
            next.push((item as Record<string, unknown>)[segment]);
          }
        }
        continue;
      }

      if (value && typeof value === "object" && segment in value) {
        next.push((value as Record<string, unknown>)[segment]);
      }
    }

    current = wildcard ? flatten(next) : next;
  }

  return flatten(current).filter((value) => value !== undefined);
}

export function getPathValue(source: unknown, path: string): unknown {
  return getPathValues(source, path)[0];
}

export function sortByPath<T>(items: T[], path?: string): T[] {
  if (!path) {
    return items;
  }

  return [...items].sort((left, right) => {
    const leftValue = getPathValue(left, path);
    const rightValue = getPathValue(right, path);

    if (leftValue == null && rightValue == null) {
      return 0;
    }

    if (leftValue == null) {
      return 1;
    }

    if (rightValue == null) {
      return -1;
    }

    return String(leftValue).localeCompare(String(rightValue), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
}

export function mergeInputData(
  keyValueInput?: string,
  jsonInput?: string,
): Record<string, unknown> {
  if (jsonInput) {
    return JSON.parse(jsonInput) as Record<string, unknown>;
  }

  return parseKeyValueInput(keyValueInput);
}

export function parseTimeExpression(value: string, now = new Date()): Date {
  const relative = value.trim().match(/^(-?\d+)\s*([smhdw])$/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = (relative[2] ?? "").toLowerCase();
    const factor =
      unit === "s"
        ? 1_000
        : unit === "m"
          ? 60_000
          : unit === "h"
            ? 3_600_000
            : unit === "d"
              ? 86_400_000
              : 604_800_000;

    return new Date(now.getTime() + amount * factor);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      `Invalid time expression "${value}". Use an ISO timestamp or relative value like 15m, -2h, or -7d.`,
    );
  }

  return parsed;
}
