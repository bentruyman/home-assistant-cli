import { REST_PATHS, WS_TYPES } from "./constants.ts";
import { HttpClient } from "./http.ts";
import { HomeAssistantWebSocket } from "./websocket.ts";

export interface ConnectionConfig {
  server: string;
  token?: string;
  timeoutSeconds: number;
  insecure: boolean;
  verbose: boolean;
}

export class HomeAssistantClient {
  #http: HttpClient;
  #config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.#config = config;
    this.#http = new HttpClient(config);
  }

  ensureToken(): string {
    if (!this.#config.token) {
      throw new Error(
        'No Home Assistant token configured. Run "hass auth login" or set HASS_TOKEN.',
      );
    }

    return this.#config.token;
  }

  async validate(): Promise<Record<string, unknown>> {
    return this.#http.request<Record<string, unknown>>({ path: REST_PATHS.api });
  }

  async getDiscoveryInfo(): Promise<Record<string, unknown>> {
    return this.#http.request<Record<string, unknown>>({ path: REST_PATHS.discoveryInfo });
  }

  async getConfig(): Promise<Record<string, any>> {
    return this.#http.request<Record<string, any>>({ path: REST_PATHS.config });
  }

  async getErrorLog(): Promise<string> {
    return this.#http.request<string>({ path: REST_PATHS.errorLog, expectText: true });
  }

  async getStates(): Promise<Record<string, any>[]> {
    return this.#http.request<Record<string, any>[]>({ path: REST_PATHS.states });
  }

  async getState(entityId: string): Promise<Record<string, any> | null> {
    try {
      return await this.#http.request<Record<string, any>>({
        path: `${REST_PATHS.states}/${entityId}`,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        "status" in error &&
        (error as { status?: number }).status === 404
      ) {
        return null;
      }

      throw error;
    }
  }

  async setState(entityId: string, payload: Record<string, unknown>): Promise<Record<string, any>> {
    return this.#http.request<Record<string, any>>({
      method: "POST",
      path: `${REST_PATHS.states}/${entityId}`,
      body: payload,
    });
  }

  async deleteState(entityId: string): Promise<boolean> {
    try {
      await this.#http.request({
        method: "DELETE",
        path: `${REST_PATHS.states}/${entityId}`,
      });
      return true;
    } catch (error) {
      if (
        error instanceof Error &&
        "status" in error &&
        (error as { status?: number }).status === 404
      ) {
        return false;
      }

      throw error;
    }
  }

  async getHistory(
    entities: string[],
    startTime: string,
    endTime?: string,
  ): Promise<Record<string, any>[][]> {
    const params = new URLSearchParams();
    if (entities.length > 0) {
      params.set("filter_entity_id", entities.join(","));
    }
    if (endTime) {
      params.set("end_time", endTime);
    }

    const suffix = params.size > 0 ? `?${params}` : "";
    return this.#http.request<Record<string, any>[][]>({
      path: `${REST_PATHS.historyPeriod}/${encodeURIComponent(startTime)}${suffix}`,
    });
  }

  async callService(
    domain: string,
    service: string,
    payload?: Record<string, unknown>,
    returnResponse = false,
  ): Promise<Record<string, any>[]> {
    const query = returnResponse ? "?return_response" : "";
    return this.#http.request<Record<string, any>[]>({
      method: "POST",
      path: `${REST_PATHS.services}/${domain}/${service}${query}`,
      body: payload ?? {},
    });
  }

  async getServices(): Promise<Record<string, any>[]> {
    return this.#http.request<Record<string, any>[]>({ path: REST_PATHS.services });
  }

  async getEvents(): Promise<Record<string, any>[]> {
    return this.#http.request<Record<string, any>[]>({ path: REST_PATHS.events });
  }

  async fireEvent(
    eventType: string,
    payload?: Record<string, unknown>,
  ): Promise<Record<string, any>> {
    return this.#http.request<Record<string, any>>({
      method: "POST",
      path: `${REST_PATHS.events}/${eventType}`,
      body: payload ?? {},
    });
  }

  async renderTemplate(template: string, variables?: Record<string, unknown>): Promise<string> {
    return this.#http.request<string>({
      method: "POST",
      path: REST_PATHS.template,
      body: {
        template,
        variables: variables ?? {},
      },
      expectText: true,
    });
  }

  async rawGet(path: string): Promise<unknown> {
    return this.#http.request<unknown>({ path });
  }

  async rawPost(path: string, body?: Record<string, unknown>): Promise<unknown> {
    return this.#http.request<unknown>({ method: "POST", path, body: body ?? {} });
  }

  async withWebSocket<T>(callback: (socket: HomeAssistantWebSocket) => Promise<T>): Promise<T> {
    const socket = await HomeAssistantWebSocket.connect({
      server: this.#config.server,
      token: this.ensureToken(),
      insecure: this.#config.insecure,
      verbose: this.#config.verbose,
    });

    try {
      return await callback(socket);
    } finally {
      socket.close();
    }
  }

  async getHealth(): Promise<Record<string, unknown>> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, unknown>>({ type: WS_TYPES.systemHealth }),
    );
  }

  async getAreas(): Promise<Record<string, any>[]> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, any>[]>({ type: WS_TYPES.areaRegistryList }),
    );
  }

  async createArea(name: string): Promise<Record<string, unknown>> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, unknown>>({ type: WS_TYPES.areaRegistryCreate, name }),
    );
  }

  async deleteArea(areaId: string): Promise<Record<string, unknown>> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, unknown>>({
        type: WS_TYPES.areaRegistryDelete,
        area_id: areaId,
      }),
    );
  }

  async renameArea(areaId: string, name: string): Promise<Record<string, unknown>> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, unknown>>({
        type: WS_TYPES.areaRegistryUpdate,
        area_id: areaId,
        name,
      }),
    );
  }

  async getDevices(): Promise<Record<string, any>[]> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, any>[]>({ type: WS_TYPES.deviceRegistryList }),
    );
  }

  async renameDevice(deviceId: string, newName: string): Promise<Record<string, unknown>> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, unknown>>({
        type: WS_TYPES.deviceRegistryUpdate,
        device_id: deviceId,
        name_by_user: newName,
      }),
    );
  }

  async assignDeviceArea(deviceId: string, areaId: string): Promise<Record<string, unknown>> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, unknown>>({
        type: WS_TYPES.deviceRegistryUpdate,
        device_id: deviceId,
        area_id: areaId,
      }),
    );
  }

  async getEntities(): Promise<Record<string, any>[]> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, any>[]>({ type: WS_TYPES.entityRegistryList }),
    );
  }

  async renameEntity(
    entityId: string,
    newEntityId?: string,
    newName?: string,
  ): Promise<Record<string, unknown>> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, unknown>>({
        type: WS_TYPES.entityRegistryUpdate,
        entity_id: entityId,
        ...(newEntityId ? { new_entity_id: newEntityId } : {}),
        ...(newName ? { name: newName } : {}),
      }),
    );
  }

  async assignEntityArea(entityId: string, areaId: string): Promise<Record<string, unknown>> {
    return this.withWebSocket((socket) =>
      socket.request<Record<string, unknown>>({
        type: WS_TYPES.entityRegistryUpdate,
        entity_id: entityId,
        area_id: areaId,
      }),
    );
  }

  async rawWs(type: string, body?: Record<string, unknown>): Promise<unknown> {
    return this.withWebSocket((socket) => socket.request({ type, ...body }));
  }

  async watchEvents(
    eventType: string | undefined,
    onMessage: (message: Record<string, unknown>) => void,
  ): Promise<void> {
    return this.withWebSocket((socket) =>
      socket.subscribe(
        {
          type: WS_TYPES.subscribeEvents,
          ...(eventType ? { event_type: eventType } : {}),
        },
        onMessage,
      ),
    );
  }
}
