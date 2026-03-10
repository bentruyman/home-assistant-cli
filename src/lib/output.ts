import YAML from "yaml";

import { type ColumnSpec, getPathValues, parseColumns, sortByPath } from "./parse.ts";

export type OutputFormat = "table" | "json" | "yaml" | "ndjson";
export type TableFormat = "plain" | "github" | "tsv";

export interface OutputOptions {
  output?: string;
  columns?: string;
  noHeaders?: boolean;
  sortBy?: string;
  tableFormat?: string;
}

function stringifyCell(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function formatPathValues(values: unknown[]): string {
  if (values.length === 0) {
    return "";
  }

  if (values.length === 1) {
    return stringifyCell(values[0]);
  }

  return values.map((value) => stringifyCell(value)).join(", ");
}

function normalizeRows(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }

  return [data];
}

function inferColumns(rows: unknown[]): ColumnSpec[] {
  const first = rows.find((row) => row && typeof row === "object" && !Array.isArray(row));
  if (first && typeof first === "object") {
    return Object.keys(first).map((key) => ({ header: key.toUpperCase(), path: key }));
  }

  return [{ header: "VALUE", path: "$" }];
}

function pad(value: string, width: number): string {
  return value.padEnd(width, " ");
}

function renderPlain(headers: string[], rows: string[][], noHeaders: boolean): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)),
  );

  const lines: string[] = [];

  if (!noHeaders) {
    lines.push(
      headers.map((header, index) => pad(header, widths[index] ?? header.length)).join("  "),
    );
  }

  for (const row of rows) {
    lines.push(
      row
        .map((cell, index) => pad(cell, widths[index] ?? cell.length))
        .join("  ")
        .trimEnd(),
    );
  }

  return lines.join("\n");
}

function renderGithub(headers: string[], rows: string[][], noHeaders: boolean): string {
  if (noHeaders) {
    return rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
  }

  const divider = headers.map(() => "---");
  return [
    `| ${headers.join(" | ")} |`,
    `| ${divider.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function renderTsv(headers: string[], rows: string[][], noHeaders: boolean): string {
  const lines = rows.map((row) => row.join("\t"));
  if (!noHeaders) {
    lines.unshift(headers.join("\t"));
  }
  return lines.join("\n");
}

export function formatTable(
  data: unknown,
  columnSpecs?: ColumnSpec[],
  noHeaders = false,
  tableFormat: TableFormat = "plain",
  sortBy?: string,
): string {
  const rows = sortByPath(normalizeRows(data), sortBy);
  const columns = columnSpecs && columnSpecs.length > 0 ? columnSpecs : inferColumns(rows);
  const headers = columns.map((column) => column.header);
  const cells = rows.map((row) =>
    columns.map((column) => formatPathValues(getPathValues(row, column.path))),
  );

  if (tableFormat === "github") {
    return renderGithub(headers, cells, noHeaders);
  }

  if (tableFormat === "tsv") {
    return renderTsv(headers, cells, noHeaders);
  }

  return renderPlain(headers, cells, noHeaders);
}

export function formatOutput(
  data: unknown,
  options: OutputOptions,
  defaultColumns?: ColumnSpec[],
): string {
  const output = (options.output || "table") as OutputFormat;

  if (typeof data === "string") {
    return data;
  }

  if (output === "json") {
    return JSON.stringify(data, null, 2);
  }

  if (output === "yaml") {
    return YAML.stringify(data).trimEnd();
  }

  if (output === "ndjson") {
    return normalizeRows(data)
      .map((row) => JSON.stringify(row))
      .join("\n");
  }

  const parsedColumns = options.columns ? parseColumns(options.columns) : defaultColumns;
  const tableFormat = (options.tableFormat || "plain") as TableFormat;
  return formatTable(data, parsedColumns, options.noHeaders ?? false, tableFormat, options.sortBy);
}
