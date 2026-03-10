import { command } from "@truyman/cli";

import pkg from "../package.json";
import { api } from "./commands/api.ts";
import { areas } from "./commands/areas.ts";
import { auth } from "./commands/auth.ts";
import { devices } from "./commands/devices.ts";
import { entities } from "./commands/entities.ts";
import { events } from "./commands/events.ts";
import { server } from "./commands/server.ts";
import { services } from "./commands/services.ts";
import { states } from "./commands/states.ts";
import { templates } from "./commands/templates.ts";
import { GlobalOptions } from "./options.ts";

export const hass = command({
  name: "hass",
  description: pkg.description,
  version: pkg.version,
  options: GlobalOptions,
  subcommands: [api, areas, auth, devices, entities, events, server, services, states, templates],
});
