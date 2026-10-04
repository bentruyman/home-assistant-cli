import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync, deflateSync, gzipSync } from "node:zlib";

// Exercise the shipped Node bundle over real HTTP: mocking fetch or only running
// under Bun cannot catch incompatibilities between Node's fetch and Undici's Agent.
describe("Node HTTP compatibility", () => {
  let root: string;
  let server: ReturnType<typeof Bun.serve>;
  let encoding = "deflate";
  let externalUrl: string | null = "https://ha.example.com";
  let internalUrl: string | null = "http://ha.local:8123";
  const requests: string[] = [];
  const states = [{ entity_id: "sensor.test", state: "on", attributes: {} }];
  const compressors = { deflate: deflateSync, gzip: gzipSync, br: brotliCompressSync };

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), "hass-node-http-"));
    const build = await Bun.build({
      entrypoints: ["src/index.ts"],
      outdir: root,
      target: "node",
    });
    if (!build.success) throw new Error(build.logs.join("\n"));
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const path = new URL(request.url).pathname;
        requests.push(path);
        if (request.headers.get("authorization") !== "Bearer test-token") {
          return new Response("Unauthorized", { status: 401 });
        }
        let body: string;
        let contentType = "application/json";
        switch (path) {
          case "/api/":
            body = JSON.stringify({ message: "API running." });
            break;
          case "/api/config":
            body = JSON.stringify({
              external_url: externalUrl,
              internal_url: internalUrl,
              location_name: "Test Home",
              version: "2026.8.2",
              latitude: 1,
            });
            break;
          case "/api/states":
            body = JSON.stringify(states);
            break;
          case "/api/template": {
            const payload = await request.json();
            if (request.method !== "POST" || payload.template !== "{{ 1 + 1 }}") {
              return new Response("Bad template request", { status: 400 });
            }
            body = "2";
            contentType = "text/plain";
            break;
          }
          default:
            return new Response("404: Not Found", { status: 404 });
        }
        const compress = compressors[encoding as keyof typeof compressors];
        return new Response(compress(body), {
          headers: { "Content-Type": contentType, "Content-Encoding": encoding },
        });
      },
    });
  });

  afterAll(() => {
    server?.stop(true);
    if (root) rmSync(root, { recursive: true, force: true });
  });

  async function run(...args: string[]) {
    const child = Bun.spawn(
      [
        "node",
        join(root, "index.js"),
        "--server",
        server.url.origin,
        "--token",
        "test-token",
        "--output",
        "json",
        ...args,
      ],
      {
        env: {
          ...process.env,
          HASS_SERVER: server.url.origin,
          HASS_TOKEN: "test-token",
          HASS_INSECURE: "false",
          XDG_DATA_HOME: join(root, "data"),
          XDG_CONFIG_HOME: join(root, "config"),
        },
        stdout: "pipe",
        stderr: "pipe",
        timeout: 10_000,
      },
    );
    const [stdout, stderr, exit] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    return { stdout, stderr, exit };
  }

  for (const compression of Object.keys(compressors)) {
    test(`decodes ${compression} JSON responses`, async () => {
      encoding = compression;
      const result = await run("states", "list");
      expect(result.stderr).toBe("");
      expect(result.exit).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual(states);
    });
  }

  test("decodes compressed template text and sends JSON request bodies", async () => {
    const result = await run("templates", "render", "{{ 1 + 1 }}");
    expect(result.stderr).toBe("");
    expect(result.exit).toBe(0);
    expect(result.stdout.trim()).toBe("2");
  });

  test("reports HTTP errors without trying to parse their text as JSON", async () => {
    const result = await run("api", "get", "/missing");
    expect(result.exit).not.toBe(0);
    expect(result.stderr).toContain("404 Not Found");
    expect(result.stderr).not.toContain("SyntaxError");
  });

  test("gets info and auth metadata from config without using discovery_info", async () => {
    requests.length = 0;
    const info = await run("server", "info");
    expect(info.exit).toBe(0);
    expect(JSON.parse(info.stdout)).toEqual({
      base_url: externalUrl,
      location_name: "Test Home",
      version: "2026.8.2",
    });
    const login = await run("auth", "login");
    expect(login.exit).toBe(0);
    expect(JSON.parse(login.stdout)).toMatchObject({
      configured: true,
      location_name: "Test Home",
      version: "2026.8.2",
    });
    const stored = JSON.parse(
      readFileSync(join(root, "data", "home-assistant", "auth.json"), "utf8"),
    );
    expect(stored.info).toEqual({
      baseUrl: externalUrl,
      locationName: "Test Home",
      version: "2026.8.2",
    });
    const status = await run("auth", "status");
    expect(status.exit).toBe(0);
    expect(JSON.parse(status.stdout)).toMatchObject({
      valid: true,
      location_name: "Test Home",
      version: "2026.8.2",
    });
    expect(requests).toEqual(["/api/config", "/api/", "/api/config", "/api/", "/api/config"]);
  });

  test("falls back to the internal URL, then the connection URL", async () => {
    externalUrl = null;
    const internal = await run("server", "info");
    expect(internal.exit).toBe(0);
    expect(JSON.parse(internal.stdout).base_url).toBe(internalUrl);
    internalUrl = null;
    const connection = await run("server", "info");
    expect(connection.exit).toBe(0);
    expect(JSON.parse(connection.stdout).base_url).toBe(server.url.origin);
  });
});
