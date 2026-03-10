import { Agent } from "undici";

import { HttpError } from "./errors.ts";
import { stripWrappingQuotes } from "./strings.ts";

export interface HttpClientOptions {
  server: string;
  token?: string;
  timeoutSeconds: number;
  insecure: boolean;
  verbose: boolean;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  path: string;
  body?: unknown;
  expectText?: boolean;
}

function normalizeServer(server: string): string {
  const sanitized = stripWrappingQuotes(server) ?? server;
  return sanitized.endsWith("/") ? sanitized.slice(0, -1) : sanitized;
}

export class HttpClient {
  #baseUrl: string;
  #token?: string;
  #timeoutSeconds: number;
  #dispatcher?: Agent;
  #verbose: boolean;

  constructor(options: HttpClientOptions) {
    this.#baseUrl = normalizeServer(options.server);
    this.#token = stripWrappingQuotes(options.token);
    this.#timeoutSeconds = options.timeoutSeconds;
    this.#dispatcher = new Agent({
      connect: {
        rejectUnauthorized: !options.insecure,
      },
    });
    this.#verbose = options.verbose;
  }

  async request<T>(options: RequestOptions): Promise<T> {
    const url = `${this.#baseUrl}${options.path.startsWith("/") ? options.path : `/${options.path}`}`;
    const signal = AbortSignal.timeout(this.#timeoutSeconds * 1_000);

    if (this.#verbose) {
      console.error(`[http] ${options.method ?? "GET"} ${url}`);
    }

    const response = await globalThis.fetch(url, {
      method: options.method ?? "GET",
      dispatcher: this.#dispatcher,
      headers: {
        ...(this.#token ? { Authorization: `Bearer ${this.#token}` } : {}),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
    } as RequestInit & { dispatcher?: Agent });

    const text = await response.text();

    if (!response.ok) {
      throw new HttpError(
        `Request failed: ${response.status} ${response.statusText}`,
        response.status,
        text,
      );
    }

    if (options.expectText) {
      return text as T;
    }

    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }
}
