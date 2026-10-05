/**
 * Episode thumbnail badges.
 *
 * GET /thumb/<type>.jpg?src=<original thumbnail url>
 *   → the original thumbnail (640x360) with a CANON / FILLER / MIXED /
 *     ANIME CANON pill drawn in the top-right corner.
 *
 * Responses are cached for a long time on Vercel's CDN, so each image is
 * only generated once.
 */

const fetch = require("node-fetch");
const sharp = require("sharp");
const PILLS = require("./badgePills");

const WIDTH = 640;
const HEIGHT = 360;
const MARGIN = 16;
const MAX_SOURCE_BYTES = 6 * 1024 * 1024;

// Only fetch thumbnails from known image hosts so this can't be used as an
// open image proxy.
const ALLOWED_HOSTS = [
  "metahub.space",
  "strem.io",
  "image.tmdb.org",
  "kitsu.app",
  "kitsu.io",
  "thetvdb.com",
  "myanimelist.net",
  "anilist.co",
  "anili.st",
  "fanart.tv",
  "tvmaze.com",
  "imdb.com",
  "media-amazon.com",
  "trakt.tv",
];

const pillBuffers = {};
for (const [type, b64] of Object.entries(PILLS)) {
  pillBuffers[type] = Buffer.from(b64, "base64");
}

function isAllowedSource(src) {
  try {
    const u = new URL(src);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

async function loadSource(src) {
  if (!src || !isAllowedSource(src)) return null;
  try {
    const res = await fetch(src, { timeout: 8000, size: MAX_SOURCE_BYTES });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (ct && !ct.startsWith("image/")) return null;
    return await res.buffer();
  } catch {
    return null;
  }
}

function blankBackground() {
  return sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#14161d" },
  });
}

async function renderThumbnail(type, src) {
  const pill = pillBuffers[type];
  if (!pill) return null;

  const pillMeta = await sharp(pill).metadata();
  const left = WIDTH - pillMeta.width - MARGIN;
  const top = MARGIN;

  let base;
  const source = await loadSource(src);
  if (source) {
    try {
      base = sharp(source).resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" });
      // Force decode now so a broken image falls back to the blank background
      base = sharp(await base.toBuffer());
    } catch {
      base = null;
    }
  }
  if (!base) base = blankBackground();

  return base
    .composite([{ input: pill, left, top }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/**
 * Handle /thumb/<type>.jpg requests. Returns true if the request was handled.
 */
async function handleThumbRequest(req, res) {
  const url = new URL(req.url, "http://localhost");
  const match = url.pathname.match(/\/thumb\/([a-z_]+)\.jpg$/);
  if (!match) return false;

  const type = match[1];
  if (!pillBuffers[type]) {
    res.statusCode = 404;
    res.end("unknown badge type");
    return true;
  }

  try {
    const img = await renderThumbnail(type, url.searchParams.get("src"));
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=2592000, s-maxage=31536000, immutable");
    res.end(img);
  } catch (err) {
    console.error("[THUMB] Error:", err.message);
    res.statusCode = 500;
    res.end("thumbnail error");
  }
  return true;
}

function buildThumbUrl(baseUrl, type, src) {
  const q = src ? `?src=${encodeURIComponent(src)}` : "";
  return `${baseUrl}/thumb/${type}.jpg${q}`;
}

module.exports = { handleThumbRequest, buildThumbUrl, renderThumbnail, isAllowedSource };
