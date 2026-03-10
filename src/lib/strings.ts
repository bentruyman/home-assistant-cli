export function stripWrappingQuotes(value?: string): string | undefined {
  if (!value) {
    return value;
  }

  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed.at(-1);
    if ((first === '"' || first === "'") && first === last) {
      return trimmed.slice(1, -1).trim();
    }
  }

  return trimmed;
}
