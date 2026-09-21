import { Container, getContainer } from "@cloudflare/containers";
import puppeteer from "@cloudflare/puppeteer";

export class InfinitySearxngContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Accept",
  "Access-Control-Max-Age": "86400",
};

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(cors)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...cors },
  });
}

function safeTarget(value) {
  let target;
  try {
    target = new URL(String(value || ""));
  } catch {
    throw new Error("A valid URL is required.");
  }
  if (!["http:", "https:"].includes(target.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  const host = target.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "0.0.0.0" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    /^10./.test(host) ||
    /^192.168./.test(host) ||
    /^169.254./.test(host) ||
    /^172.(1[6-9]|2d|3[01])./.test(host);
  if (blocked) throw new Error("Private network URLs are not allowed.");
  return target.href;
}

async function inspectUrl(env, value) {
  const target = safeTarget(value);
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.goto(target, { waitUntil: "domcontentloaded", timeout: 25000 });
    const finalUrl = page.url();
    const result = await page.evaluate(() => {
      const clean = (value) => String(value || "").replace(/s+/g, " ").trim();
      const unique = (items, key) => {
        const seen = new Set();
        return items.filter((item) => {
          const value = key(item);
          if (!value || seen.has(value)) return false;
          seen.add(value);
          return true;
        });
      };
      const meta = (selector) => clean(document.querySelector(selector)?.content);
      const headings = [...document.querySelectorAll("h1,h2,h3")]
        .map((node) => ({ level: node.tagName.toLowerCase(), text: clean(node.textContent) }))
        .filter((item) => item.text)
        .slice(0, 30);
      const links = unique(
        [...document.querySelectorAll("a[href]")]
          .map((node) => ({ text: clean(node.textContent), url: node.href }))
          .filter((item) => /^https?:/.test(item.url)),
        (item) => item.url
      ).slice(0, 40);
      const images = unique(
        [...document.images]
          .map((node) => ({
            url: node.currentSrc || node.src,
            alt: clean(node.alt),
            width: node.naturalWidth || node.width || 0,
            height: node.naturalHeight || node.height || 0,
          }))
          .filter((item) => /^https?:/.test(item.url)),
        (item) => item.url
      ).slice(0, 30);
      return {
        title: clean(document.title),
        description: meta('meta[name="description"]') || meta('meta[property="og:description"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.href || "",
        image: meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]'),
        siteName: meta('meta[property="og:site_name"]'),
        headings,
        links,
        images,
        text: clean(document.body?.innerText).slice(0, 14000),
      };
    });
    return { requestedUrl: target, finalUrl, ...result };
  } finally {
    await browser.close();
  }
}

function buildPlan(body, inspections) {
  const query = String(body.query || body.prompt || "").trim();
  const selected = Array.isArray(body.selected) ? body.selected.slice(0, 24) : [];
  const titles = inspections.map((item) => item.title).filter(Boolean);
  const subject = query || titles[0] || "Code Phi project";
  return {
    subject,
    intent: String(body.intent || "Turn selected research into a useful, source-backed web experience."),
    recommendedBuild: inspections.length
      ? "Create a focused source-backed site using the inspected pages as evidence."
      : "Create a focused site from the supplied query and selected media.",
    sections: [
      "Clear opening statement and primary action",
      "Evidence-driven overview",
      "Selected image, video, and audio cards",
      "Useful tools or next actions",
      "Compact source and provenance section",
    ],
    selected,
    sources: inspections.map((item) => ({
      title: item.title,
      url: item.finalUrl,
      description: item.description,
      canonical: item.canonical,
      image: item.image,
      headings: item.headings,
    })),
    gptContext: {
      instruction:
        "Build polished operational HTML from this plan. Use inspected evidence, preserve source URLs, avoid inventing facts, and make every section useful.",
      query: subject,
      selected,
      inspections,
    },
  };
}

async function codePhiRoute(request, env, pathname) {
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "A JSON request body is required." }, 400);
  }

  try {
    if (pathname === "/code-phi/inspect") {
      return json({ ok: true, inspection: await inspectUrl(env, body.url) });
    }

    const urls = [
      ...(Array.isArray(body.urls) ? body.urls : []),
      ...(body.url ? [body.url] : []),
    ].slice(0, 3);
    const inspections = [];
    for (const url of urls) inspections.push(await inspectUrl(env, url));
    return json({ ok: true, plan: buildPlan(body, inspections) });
  } catch (error) {
    return json({ ok: false, error: error?.message || "Browser inspection failed." }, 400);
  }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        service: "Infinity SearXNG",
        browser: Boolean(env.BROWSER),
        codePhi: ["/code-phi/inspect", "/code-phi/plan"],
      });
    }

    if (url.pathname === "/code-phi/inspect" || url.pathname === "/code-phi/plan") {
      return codePhiRoute(request, env, url.pathname);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return withCors(new Response("Method not allowed", { status: 405 }));
    }

    // Every existing search path still uses the same named SearXNG container.
    const container = getContainer(env.SEARXNG, "infinity-searxng");
    return withCors(await container.fetch(request));
  },
};
