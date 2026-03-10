import { command } from "@truyman/cli";

import { buildPayload, createClient, printOutput, readInputFile } from "../lib/runtime.ts";
import { GlobalOptions } from "../options.ts";

const render = command({
  name: "render",
  description: "Render a Home Assistant template on the server",
  inherits: GlobalOptions,
  args: [
    { name: "template", type: "string", description: "Template string", optional: true },
  ] as const,
  options: {
    file: {
      type: "string",
      description: "Template file path",
      placeholder: "path",
    },
    data: {
      type: "string",
      description: "Variables as key=value pairs",
      placeholder: "pairs",
    },
    json: {
      type: "string",
      description: "Variables as a JSON object",
      placeholder: "json",
    },
  },
  handler: async ([templateArg], options) => {
    const template = options.file ? readInputFile(options.file) : templateArg;
    if (!template) {
      throw new Error("Provide a template string argument or --file.");
    }

    const client = createClient(options);
    const rendered = await client.renderTemplate(
      template,
      buildPayload(options.data, options.json),
    );
    printOutput(rendered, options);
  },
});

export const templates = command({
  name: "templates",
  description: "Render Home Assistant templates",
  subcommands: [render],
});
