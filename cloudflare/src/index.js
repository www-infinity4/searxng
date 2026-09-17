import { Container, getContainer } from "@cloudflare/containers";

export class InfinitySearxngContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Accept",
  "Access-Control-Max-Age": "86400",
};

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "GET" && request.method !== "HEAD") return withCors(new Response("Method not allowed", { status: 405 }));

    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true, service: "Infinity SearXNG" }), {
        headers: { "content-type": "application/json; charset=utf-8", ...cors },
      });
    }

    // A single named instance keeps SearXNG warm and gives Infinity Phi one stable search backend.
    const container = getContainer(env.SEARXNG, "infinity-searxng");
    return withCors(await container.fetch(request));
  },
};
