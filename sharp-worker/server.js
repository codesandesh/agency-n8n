const express = require('express');
const sharp = require('sharp');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

const SECRET = process.env.SHARP_WORKER_SECRET || '';

// ── Auth middleware ────────────────────────────────────────────
function checkAuth(req, res, next) {
  if (!SECRET) return next();
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// ── Health check ───────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ── Fetch a URL and return a Buffer (follows redirects) ────────
function fetchBuffer(url, timeoutMs = 7000) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location, timeoutMs).then(resolve);
      }
      if (res.statusCode !== 200) return resolve(null);
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', () => resolve(null));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    setTimeout(() => { try { req.destroy(); } catch (_) { } resolve(null); }, timeoutMs);
  });
}

// ── Fetch logo for a domain (multiple strategies) ─────────────
async function fetchLogo(domain) {
  if (!domain) return null;

  // Strategy 1: Clearbit Logo API (best quality, returns PNG)
  const clearbitUrl = `https://logo.clearbit.com/${domain}?size=300`;
  console.log(`[logo] Trying clearbit: ${clearbitUrl}`);
  let buf = await fetchBuffer(clearbitUrl);
  if (buf && buf.length > 100) {
    console.log(`[logo] Got from Clearbit: ${buf.length} bytes`);
    return buf;
  }

  // Strategy 2: Google Favicon HD (fallback)
  const googleUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
  console.log(`[logo] Trying Google favicon: ${googleUrl}`);
  buf = await fetchBuffer(googleUrl);
  if (buf && buf.length > 50) {
    console.log(`[logo] Got from Google: ${buf.length} bytes`);
    return buf;
  }

  console.log(`[logo] All strategies failed for ${domain}`);
  return null;
}

// ── Composite endpoint ─────────────────────────────────────────
// POST /composite
// Body: {
//   base_image_b64, svg_overlay_b64,
//   logo_b64?,        // pre-fetched logo (optional, takes priority)
//   company_domain?,  // domain to auto-fetch logo if logo_b64 not provided
//   logo_x?, logo_y?, logo_size?,
//   width?, height?
// }
app.post('/composite', checkAuth, async (req, res) => {
  console.log(`[sharp] Composite request. Base: ${req.body?.base_image_b64?.length || 0}B`);
  try {
    const {
      base_image_b64,
      svg_overlay_b64,
      width = 1080,
      height = 1350,
    } = req.body;

    if (!base_image_b64) return res.status(400).json({ error: 'Missing base_image_b64' });
    if (!svg_overlay_b64) return res.status(400).json({ error: 'Missing svg_overlay_b64' });

    const bgBuffer = Buffer.from(base_image_b64, 'base64');
    const svgBuffer = Buffer.from(svg_overlay_b64, 'base64');

    // Build composite layers — SVG text overlay only
    const layers = [{ input: svgBuffer, top: 0, left: 0 }];

    const finalPng = await sharp(bgBuffer)
      .resize(width, height, { fit: 'cover', position: 'top' })
      .composite(layers)
      .png({ quality: 95 })
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Content-Length', finalPng.length);
    res.send(finalPng);

  } catch (err) {
    console.error('[sharp] composite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[sharp-worker] listening on :${PORT}`));
