# @truyman/hass

A Bun-built CLI for Home Assistant, bundled for Node.js and published to npm as `@truyman/hass`.

## Install

```bash
npm install -g @truyman/hass
```

## Quick Start

Create a long-lived access token in Home Assistant, then store it locally:

```bash
hass auth login
```

The default profile is stored at `${XDG_DATA_HOME:-~/.local/share}/home-assistant/auth.json`.

You can always override the stored profile with flags or environment variables:

```bash
export HASS_SERVER=http://homeassistant.local:8123
export HASS_TOKEN=your-token

hass server info
```

## Commands

### `hass auth`

- `login` - Prompt for server URL and long-lived access token, validate, and store them.
- `status` - Show the active connection source and whether the credentials validate.
- `logout` - Remove the stored default profile.

### `hass server`

- `info`
- `config`
- `components`
- `directories`
- `health`
- `logs`

### `hass states`

- `list [filter]`
- `get <entity>`
- `set <entity> [state]`
- `delete <entity>`
- `history [entities...]`
- `toggle <entities...>`
- `on <entities...>`
- `off <entities...>`

Examples:

```bash
hass states list sensor\\.
hass states get light.kitchen
hass states set input_boolean.night_mode on
hass states history light.kitchen --since -2h --end 0m
```

### `hass services`

- `list [filter]`
- `call <domain.service>`

Examples:

```bash
hass services list light\\.
hass services call light.turn_on --data entity_id=light.kitchen,brightness=180
hass services call weather.get_forecasts --json '{"entity_id":"weather.home"}' --return-response
```

### `hass events`

- `list`
- `fire <event>`
- `watch [event]`

### `hass templates`

- `render [template]`

Examples:

```bash
hass templates render '{{ states("sun.sun") }}'
hass templates render --file ./template.j2 --data entity_id=light.kitchen
```

### `hass areas`

- `list [filter]`
- `create <names...>`
- `delete <areas...>`
- `rename <area> <name>`

### `hass devices`

- `list [filter]`
- `rename <device> <name>`
- `assign-area <area> [devices...]`

### `hass entities`

- `list [filter]`
- `rename <entity> [newId] --name <name>`
- `assign-area <area> [entities...]`

### `hass api`

- `get <path>`
- `post <path>`
- `ws <type>`

Examples:

```bash
hass api get /api/states
hass api post /api/events/custom_event --data value=1
hass api ws config/area_registry/list
```

## Global Options

- `--server`
- `--token`
- `--timeout`
- `--insecure`
- `--output table|json|yaml|ndjson`
- `--columns NAME=path,...`
- `--sort-by path`
- `--no-headers`
- `--table-format plain|github|tsv`
- `--verbose`

Connection precedence is:

1. CLI flags
2. Environment variables
3. Stored auth profile
4. Built-in defaults

## Migration

| Old CLI                                     | New CLI                                 |
| ------------------------------------------- | --------------------------------------- |
| `hass-cli info`                             | `hass server info`                      |
| `hass-cli config full`                      | `hass server config`                    |
| `hass-cli config components`                | `hass server components`                |
| `hass-cli state list`                       | `hass states list`                      |
| `hass-cli state get light.kitchen`          | `hass states get light.kitchen`         |
| `hass-cli state edit light.kitchen`         | `hass states set light.kitchen ...`     |
| `hass-cli state history ...`                | `hass states history ...`               |
| `hass-cli service list`                     | `hass services list`                    |
| `hass-cli service call light.turn_on`       | `hass services call light.turn_on`      |
| `hass-cli event fire custom_event`          | `hass events fire custom_event`         |
| `hass-cli event watch`                      | `hass events watch`                     |
| `hass-cli template ...`                     | `hass templates render ...`             |
| `hass-cli area list`                        | `hass areas list`                       |
| `hass-cli device assign ...`                | `hass devices assign-area ...`          |
| `hass-cli entity assign ...`                | `hass entities assign-area ...`         |
| `hass-cli raw get /api/states`              | `hass api get /api/states`              |
| `hass-cli raw ws config/area_registry/list` | `hass api ws config/area_registry/list` |

The new CLI intentionally drops the old Supervisor/OS management commands, Docker packaging, network discovery, browser map helpers, and local Jinja rendering.

## Development

```bash
bun install
bun run check
bun test
bun run build
```

Tooling follows the same baseline as the `dev` repo: Bun, `@truyman/cli`, `oxfmt`, `oxlint`, husky, lint-staged, and `release-it`.
