const express = require('express');
const sharp   = require('sharp');
const app     = express();

app.use(express.json({ limit: '100mb' }));

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

// ── Composite endpoint ─────────────────────────────────────────
// POST /composite
// Body: { base_image_b64, svg_overlay_b64, width?, height? }
// Returns: PNG binary
app.post('/composite', checkAuth, async (req, res) => {
  try {
    const { base_image_b64, svg_overlay_b64, width = 1080, height = 1350 } = req.body;

    if (!base_image_b64) return res.status(400).json({ error: 'Missing base_image_b64' });
    if (!svg_overlay_b64) return res.status(400).json({ error: 'Missing svg_overlay_b64' });

    const bgBuffer  = Buffer.from(base_image_b64,  'base64');
    const svgBuffer = Buffer.from(svg_overlay_b64, 'base64'); // raw SVG XML bytes

    const finalPng = await sharp(bgBuffer)
      .resize(width, height, { fit: 'cover', position: 'top' })
      .composite([{ input: svgBuffer, top: 0, left: 0 }])
      .png({ quality: 95 })
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.set('Content-Length', finalPng.length);
    res.send(finalPng);

  } catch (err) {
    console.error('[sharp-worker] composite error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[sharp-worker] listening on :${PORT}`));
