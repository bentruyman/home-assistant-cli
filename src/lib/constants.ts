export const DEFAULT_SERVER = "http://localhost:8123";

export const REST_PATHS = {
  api: "/api/",
  config: "/api/config",
  discoveryInfo: "/api/discovery_info",
  errorLog: "/api/error_log",
  events: "/api/events",
  historyPeriod: "/api/history/period",
  services: "/api/services",
  states: "/api/states",
  template: "/api/template",
} as const;

export const WS_TYPES = {
  areaRegistryList: "config/area_registry/list",
  areaRegistryCreate: "config/area_registry/create",
  areaRegistryDelete: "config/area_registry/delete",
  areaRegistryUpdate: "config/area_registry/update",
  deviceRegistryList: "config/device_registry/list",
  deviceRegistryUpdate: "config/device_registry/update",
  entityRegistryGet: "config/entity_registry/get",
  entityRegistryList: "config/entity_registry/list",
  entityRegistryUpdate: "config/entity_registry/update",
  subscribeEvents: "subscribe_events",
  systemHealth: "system_health/info",
} as const;
