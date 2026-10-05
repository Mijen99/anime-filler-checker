/**
 * Anime Filler Checker — Stremio Addon (Local Server)
 *
 * For local development: `node index.js`
 * For Vercel: see api/[...path].js
 */

const http = require("http");
const handler = require("./api/[...path].js");

const PORT = process.env.PORT || 7000;

http.createServer(handler).listen(PORT);

console.log(`
╔═══════════════════════════════════════════════════════╗
║         Anime Filler Checker — Stremio Addon          ║
╠═══════════════════════════════════════════════════════╣
║  Running at: http://localhost:${PORT}                    ║
║  Manifest:   http://localhost:${PORT}/manifest.json      ║
║                                                       ║
║  Install in Stremio:                                  ║
║  http://localhost:${PORT}/manifest.json                  ║
║                                                       ║
║  Features:                                            ║
║  • Filler/canon badges on episode thumbnails          ║
║  • Subtitle track with filler badge notification      ║
║  • Filler statistics per show                         ║
║  • MAL scores and metadata                            ║
╚═══════════════════════════════════════════════════════╝
`);
