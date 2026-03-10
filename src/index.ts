#!/usr/bin/env node
import { run } from "@truyman/cli";

import { hass } from "./cli.ts";

await run(hass, process.argv.slice(2));
