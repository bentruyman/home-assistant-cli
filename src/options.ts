import type { Options } from "@truyman/cli";

export const GlobalOptions = {
  verbose: {
    type: "boolean",
    short: "v",
    long: "verbose",
    description: "Enable verbose output",
  },
  server: {
    type: "string",
    long: "server",
    description: "Home Assistant server URL",
    placeholder: "url",
  },
  token: {
    type: "string",
    long: "token",
    description: "Long-lived access token",
    placeholder: "token",
  },
  timeout: {
    type: "number",
    long: "timeout",
    description: "Network timeout in seconds",
  },
  insecure: {
    type: "boolean",
    long: "insecure",
    description: "Disable TLS certificate verification",
    negatable: true,
  },
  output: {
    type: "string",
    long: "output",
    description: "Output format: table, json, yaml, ndjson",
    default: "table",
  },
  columns: {
    type: "string",
    long: "columns",
    description: "Custom columns as NAME=path pairs",
    placeholder: "spec",
  },
  noHeaders: {
    type: "boolean",
    long: "no-headers",
    description: "Hide table headers",
  },
  sortBy: {
    type: "string",
    long: "sort-by",
    description: "Sort results by a dotted path expression",
    placeholder: "path",
  },
  tableFormat: {
    type: "string",
    long: "table-format",
    description: "Table format: plain, github, tsv",
    default: "plain",
  },
} as const satisfies Options;
