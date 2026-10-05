/**
 * Vercel Serverless Function — Stremio Addon catch-all handler.
 *
 * Routes all Stremio protocol requests through the addon SDK's router.
 */

const { getRouter } = require("stremio-addon-sdk");
const builder = require("../lib/addon");
const { handleThumbRequest } = require("../lib/thumbnails");

const MAINTENANCE_STREAM = JSON.stringify({
  streams: [{
    name: "🚧 ADDON DISABLED",
    description: "AnimeFillerChecker addon is currently disabled indefinitely.\nThere were too many requests coming in and my Vercel deployment can't provide it anymore. Until I find a sustainable hosting solution, the Stremio addon will stay offline.\nThe browser extension at animefillerchecker.com still works for filler info, visit the site for updates.\nIn the meantime you can still host the stremio addon on your local device on your own if you want.\n\nhttps://github.com/nehirakbass/anime-filler-checker",
    externalUrl: "https://github.com/nehirakbass/anime-filler-checker",
  }],
});
const MAINTENANCE_SUBTITLES = JSON.stringify({ subtitles: [] });

const addonInterface = builder.getInterface();
const router = getRouter(addonInterface);

module.exports = async (req, res) => {
  // Set CORS headers (required by Stremio addon protocol)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  const reqPath = req.url || "";

  // Remember our public address so episode thumbnails can link back here
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) {
    const proto = req.headers["x-forwarded-proto"] || (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
    builder.setPublicBaseUrl(`${proto}://${host}`);
  }

  // Badged episode thumbnails: /thumb/<type>.jpg?src=...
  if (/\/thumb\//.test(reqPath) && (await handleThumbRequest(req, res))) return;

  // Maintenance mode: intercept early, serve cached static response
  if (builder.MAINTENANCE_MODE && /\/(stream|subtitles)\//.test(reqPath)) {
    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=3600");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.statusCode = 200;
    res.end(reqPath.includes("/subtitles/") ? MAINTENANCE_SUBTITLES : MAINTENANCE_STREAM);
    return;
  }

  // CDN caching
  if (reqPath.includes("/manifest.json")) {
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
  } else if (/\/(stream|subtitles)\//.test(reqPath)) {
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400");
  }

  router(req, res, () => {
    // Fallback: if no route matched, return 404
    res.statusCode = 404;
    res.end(JSON.stringify({ err: "not found" }));
  });
};
