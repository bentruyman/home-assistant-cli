export function filterByRegex<T>(
  items: T[],
  expression: string | undefined,
  pick: (item: T) => string,
): T[] {
  if (!expression || expression === ".*") {
    return items;
  }

  const regex = new RegExp(expression);
  return items.filter((item) => regex.test(pick(item)));
}

export function findByIdOrName<T>(
  items: T[],
  idOrName: string,
  idKey: keyof T,
  nameKey: keyof T,
): T | undefined {
  return items.find((item) => item[idKey] === idOrName || item[nameKey] === idOrName);
}

export function dedupeBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    output.push(item);
  }

  return output;
}
