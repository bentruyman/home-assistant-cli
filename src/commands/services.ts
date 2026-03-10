import { command } from "@truyman/cli";

import { buildPayload, createClient, printOutput } from "../lib/runtime.ts";
import { filterByRegex } from "../lib/selectors.ts";
import { GlobalOptions } from "../options.ts";

const serviceColumns = [
  { header: "DOMAIN", path: "domain" },
  { header: "SERVICE", path: "service" },
  { header: "DESCRIPTION", path: "description" },
] as const;

function flattenServices(services: Record<string, any>[]): Record<string, unknown>[] {
  return services.flatMap((domainEntry) =>
    Object.entries(domainEntry.services ?? {}).map(([service, value]) => ({
      domain: domainEntry.domain,
      service,
      ...(value as Record<string, unknown>),
    })),
  );
}

const list = command({
  name: "list",
  description: "List available Home Assistant services",
  inherits: GlobalOptions,
  args: [{ name: "filter", type: "string", description: "Regex filter", optional: true }] as const,
  handler: async ([filter], options) => {
    const client = createClient(options);
    const services = flattenServices(await client.getServices());
    const filtered = filterByRegex(
      services,
      filter,
      (item) => `${item.domain ?? ""}.${item.service ?? ""}`,
    );
    printOutput(filtered, options, [...serviceColumns]);
  },
});

const call = command({
  name: "call",
  description: "Call a Home Assistant service",
  inherits: GlobalOptions,
  args: [{ name: "service", type: "string", description: "domain.service" }] as const,
  options: {
    data: {
      type: "string",
      description: "Arguments as key=value pairs",
      placeholder: "pairs",
    },
    json: {
      type: "string",
      description: "JSON payload for the service call",
      placeholder: "json",
    },
    returnResponse: {
      type: "boolean",
      long: "return-response",
      description: "Ask Home Assistant to return service response payloads",
    },
  },
  handler: async ([service], options) => {
    const [domain, serviceName] = service.split(".");
    if (!domain || !serviceName) {
      throw new Error(`Expected service to use domain.service format, received "${service}".`);
    }

    const client = createClient(options);
    const payload = buildPayload(options.data, options.json);
    printOutput(
      await client.callService(domain, serviceName, payload, options.returnResponse),
      options,
    );
  },
});

export const services = command({
  name: "services",
  description: "List and call Home Assistant services",
  subcommands: [call, list],
});
