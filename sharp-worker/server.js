const express = require('express');
const sharp = require('sharp');
const app = express();

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
// Body: { base_image_b64, svg_overlay_b64, logo_b64?, logo_x?, logo_y?, logo_size?, width?, height? }
// Returns: PNG binary
app.post('/composite', checkAuth, async (req, res) => {
  console.log(`[sharp-worker] Received composite request. Base size: ${req.body?.base_image_b64?.length || 0} bytes`);
  try {
    const {
      base_image_b64,
      svg_overlay_b64,
      logo_b64,
      logo_x = 828,   // cx - r + 8  (cx=918, r=90 as set in SVG code)
      logo_y = 66,    // cy - r + 8  (cy=148, r=90 as set in SVG code)
      logo_size = 164, // (r - 8) * 2
      width = 1080,
      height = 1350
    } = req.body;

    if (!base_image_b64) return res.status(400).json({ error: 'Missing base_image_b64' });
    if (!svg_overlay_b64) return res.status(400).json({ error: 'Missing svg_overlay_b64' });

    const bgBuffer = Buffer.from(base_image_b64, 'base64');
    const svgBuffer = Buffer.from(svg_overlay_b64, 'base64'); // raw SVG XML bytes

    // Build composite layers array — SVG overlay is always first
    const layers = [{ input: svgBuffer, top: 0, left: 0 }];

    // If a logo is provided, composite it separately as a rasterized image
    // This bypasses librsvg's inability to render embedded base64 <image> tags
    if (logo_b64) {
      try {
        const logoRaw = Buffer.from(logo_b64, 'base64');
        // Resize the logo to fit the badge circle (logo_size x logo_size), keep aspect ratio
        const logoResized = await sharp(logoRaw)
          .resize(logo_size, logo_size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();

        // Clip logo to circle using a circular mask
        const circleMask = Buffer.from(
          `<svg width="${logo_size}" height="${logo_size}">` +
          `<circle cx="${logo_size / 2}" cy="${logo_size / 2}" r="${logo_size / 2}" fill="white"/>` +
          `</svg>`
        );
        const logoCircle = await sharp(logoResized)
          .composite([{ input: circleMask, blend: 'dest-in' }])
          .png()
          .toBuffer();

        layers.push({ input: logoCircle, top: logo_y, left: logo_x, blend: 'over' });
        console.log(`[sharp-worker] Logo composited at (${logo_x}, ${logo_y}) size=${logo_size}px`);
      } catch (logoErr) {
        console.warn('[sharp-worker] Logo composite failed (skipping):', logoErr.message);
      }
    }

    const finalPng = await sharp(bgBuffer)
      .resize(width, height, { fit: 'cover', position: 'top' })
      .composite(layers)
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
