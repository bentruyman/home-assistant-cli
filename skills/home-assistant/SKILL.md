---
name: home-assistant
description: |
  How to use the `hass` CLI to interact with a Home Assistant instance — checking entity states, controlling devices, calling services, managing areas, firing events, rendering templates, and making raw API calls. Use this skill whenever the user wants to interact with Home Assistant, control smart home devices, check sensor readings, toggle lights or switches, view entity history, call HA services, manage areas or devices, or do anything involving the `hass` command. Also use it when the user mentions entity IDs (like `light.kitchen`, `sensor.temperature`), Home Assistant domains, or wants to query/control their smart home setup — even if they don't explicitly say "hass".
---

# Home Assistant CLI (`hass`)

Use the `hass` CLI to interact with a Home Assistant instance. The CLI communicates over both REST API and WebSocket, so it can do everything from reading sensor states to subscribing to real-time events.

## Connection

The CLI resolves connection details in this order:

1. CLI flags (`--server`, `--token`)
2. Environment variables (`HASS_SERVER`, `HASS_TOKEN`, `HASS_TIMEOUT`, `HASS_INSECURE`)
3. Stored auth profile (`${XDG_DATA_HOME:-~/.local/share}/home-assistant/auth.json`)
4. Defaults (`http://localhost:8123`, no token)

If the user hasn't logged in yet, have them run `hass auth login` first — it interactively prompts for the server URL and a long-lived access token, validates them, and stores the profile.

Check auth status with `hass auth status`. Remove credentials with `hass auth logout`.

## Global Options

These flags work with any command:

| Flag                      | Description                                                |
| ------------------------- | ---------------------------------------------------------- |
| `--verbose, -v`           | Enable verbose output (shows HTTP/WS traffic)              |
| `--server <url>`          | Home Assistant server URL                                  |
| `--token <token>`         | Long-lived access token                                    |
| `--timeout <seconds>`     | Network timeout (default: 10s)                             |
| `--insecure`              | Disable TLS certificate verification                       |
| `--output <format>`       | Output format: `table` (default), `json`, `yaml`, `ndjson` |
| `--columns <spec>`        | Custom columns as `NAME=path` pairs                        |
| `--no-headers`            | Hide table headers                                         |
| `--sort-by <path>`        | Sort by dotted path expression                             |
| `--table-format <format>` | Table format: `plain` (default), `github`, `tsv`           |

Use `--output json` when you need to parse output programmatically. Use `--columns` to reshape table output (e.g., `--columns "Name=attributes.friendly_name,State=state"`).

## Data Input

Commands that accept payloads (`states set`, `services call`, `events fire`, `api post`, `api ws`) support two input methods:

- `--data <pairs>` — Key=value pairs: `entity_id=light.kitchen,brightness=180`
- `--json <json>` — Raw JSON: `--json '{"entity_id": "light.kitchen", "brightness": 180}'`

## Commands

### Entity States — `hass states`

The most common operations. Entity IDs follow the pattern `domain.object_id` (e.g., `light.living_room`, `sensor.outdoor_temp`).

```bash
# List all entities (or filter with regex)
hass states list
hass states list "light\."
hass states list "sensor\.temp"

# Get a specific entity's state
hass states get sensor.outdoor_temperature

# Set an entity's state
hass states set input_boolean.guest_mode on
hass states set sensor.manual_value 42 --data unit_of_measurement=°C

# Toggle, turn on, turn off (accepts multiple entities)
hass states toggle light.kitchen light.living_room
hass states on switch.fan
hass states off light.bedroom light.hallway

# View state history (default: last 24 hours)
hass states history sensor.temperature
hass states history light.kitchen --from -2h --to 0m

# Delete an entity state
hass states delete sensor.stale_entity
```

### Services — `hass services`

```bash
# List available services (or filter)
hass services list
hass services list "light\."

# Call a service
hass services call light.turn_on --data entity_id=light.kitchen,brightness=200
hass services call climate.set_temperature --json '{"entity_id": "climate.thermostat", "temperature": 72}'
hass services call script.goodnight
```

### Events — `hass events`

```bash
# List event types
hass events list

# Fire a custom event
hass events fire custom_alert --data message="Motion detected"

# Watch events in real-time (WebSocket subscription)
hass events watch                    # all events
hass events watch state_changed      # only state changes
```

### Areas — `hass areas`

```bash
hass areas list
hass areas create "Living Room" "Kitchen" "Bedroom"
hass areas rename living_room "Family Room"
hass areas delete kitchen
```

### Devices — `hass devices`

```bash
hass devices list
hass devices list "hue"
hass devices rename <device_id> "Kitchen Light Strip"
hass devices assign-area "Living Room" device_id_1 device_id_2
hass devices assign-area "Kitchen" --match "hue.*strip"
```

### Entities — `hass entities`

Manage the entity registry (rename entity IDs, assign areas):

```bash
hass entities list
hass entities list "light\."
hass entities rename light.old_name light.new_name
hass entities rename light.kitchen --name "Kitchen Ceiling Light"
hass entities assign-area "Kitchen" light.kitchen sensor.kitchen_temp
hass entities assign-area "Bedroom" --match "light\.bedroom"
```

### Server Info — `hass server`

```bash
hass server info          # Instance info (version, location, base URL)
hass server config        # Full HA configuration
hass server components    # Loaded components/integrations
hass server directories   # Allowed external directories
hass server health        # System health check
hass server logs          # Error log
```

### Templates — `hass templates`

Render Jinja2 templates on the Home Assistant server:

```bash
hass templates render "{{ states('sensor.temperature') }}"
hass templates render --file template.j2
```

### Raw API — `hass api`

For anything not covered by the other commands:

```bash
hass api get /api/states
hass api post /api/services/light/turn_on --json '{"entity_id": "light.kitchen"}'
hass api ws config/area_registry/list
```

## Common Patterns

**Check if something is on:**

```bash
hass states get light.kitchen --output json
```

**Find all entities in a domain:**

```bash
hass states list "^climate\."
```

**Control multiple entities at once:**

```bash
hass states off light.kitchen light.living_room light.bedroom
```

**Get machine-readable output for scripting:**

```bash
hass states list --output json
hass devices list --output ndjson
```

**Custom table columns:**

```bash
hass states list --columns "Name=attributes.friendly_name,State=state,Updated=last_updated"
```

**Sort results:**

```bash
hass states list "sensor\." --sort-by state
```
