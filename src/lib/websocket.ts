import { Agent } from "undici";

import { HassError } from "./errors.ts";

export interface WebSocketClientOptions {
  server: string;
  token: string;
  insecure: boolean;
  verbose: boolean;
}

type NodeWebSocketConstructor = new (
  url: string,
  protocols?: string | string[],
  options?: Record<string, unknown>,
) => WebSocket;

function toWebSocketUrl(server: string): string {
  const base = server.endsWith("/") ? server.slice(0, -1) : server;
  return `${base.replace(/^http/i, "ws")}/api/websocket`;
}

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(), { once: true });
    socket.addEventListener("error", (event) => reject(event), { once: true });
  });
}

export class HomeAssistantWebSocket {
  #socket: WebSocket;
  #nextId = 1;
  #verbose: boolean;

  private constructor(socket: WebSocket, verbose: boolean) {
    this.#socket = socket;
    this.#verbose = verbose;
  }

  static async connect(options: WebSocketClientOptions): Promise<HomeAssistantWebSocket> {
    const dispatcher = new Agent({
      connect: {
        rejectUnauthorized: !options.insecure,
      },
    });
    const NodeWebSocket = WebSocket as unknown as NodeWebSocketConstructor;
    const socket = new NodeWebSocket(toWebSocketUrl(options.server), undefined, { dispatcher });
    await waitForOpen(socket);

    const authRequired = await HomeAssistantWebSocket.receive(socket);
    if (authRequired.type !== "auth_required") {
      throw new HassError("Home Assistant websocket did not request authentication.");
    }

    socket.send(JSON.stringify({ type: "auth", access_token: options.token }));
    const authResult = await HomeAssistantWebSocket.receive(socket);

    if (authResult.type !== "auth_ok") {
      throw new HassError(authResult.message || "Home Assistant websocket authentication failed.");
    }

    return new HomeAssistantWebSocket(socket, options.verbose);
  }

  private static receive(socket: WebSocket): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<string>) => {
        cleanup();
        resolve(JSON.parse(event.data));
      };
      const onError = (event: Event) => {
        cleanup();
        reject(event);
      };
      const onClose = () => {
        cleanup();
        reject(new HassError("Home Assistant websocket connection closed."));
      };
      const cleanup = () => {
        socket.removeEventListener("message", onMessage as EventListener);
        socket.removeEventListener("error", onError);
        socket.removeEventListener("close", onClose);
      };

      socket.addEventListener("message", onMessage as EventListener, { once: true });
      socket.addEventListener("error", onError, { once: true });
      socket.addEventListener("close", onClose, { once: true });
    });
  }

  async request<T>(frame: Record<string, unknown>): Promise<T> {
    const id = this.#nextId++;
    if (this.#verbose) {
      console.error(`[ws] ${frame.type}`);
    }

    this.#socket.send(JSON.stringify({ ...frame, id }));

    while (true) {
      const message = await HomeAssistantWebSocket.receive(this.#socket);
      if (message.id !== id) {
        continue;
      }

      if (message.type === "result" && message.success === false) {
        throw new HassError(message.error?.message || `WebSocket request failed for ${frame.type}`);
      }

      return (message.result ?? message) as T;
    }
  }

  async subscribe(
    frame: Record<string, unknown>,
    onMessage: (message: Record<string, unknown>) => void,
  ): Promise<void> {
    const id = this.#nextId++;
    this.#socket.send(JSON.stringify({ ...frame, id }));

    while (true) {
      const message = await HomeAssistantWebSocket.receive(this.#socket);
      if (message.id === id && message.type === "result" && message.success === false) {
        throw new HassError(message.error?.message || `Subscription failed for ${frame.type}`);
      }

      if (message.type === "event") {
        onMessage(message);
      }
    }
  }

  close(): void {
    this.#socket.close();
  }
}
