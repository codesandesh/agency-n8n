import json

# Define the new jsCode for V8 Layout (Focus: Text Wrapping & Width)
new_js_code = r"""// ============================================================
// HYPERSCALER NEWS CARD COMPOSITOR v5.5
// Composites text overlay onto AI-generated background
// V8: Wider text wrapping & improved width utilization
// ============================================================

const geminiData = $('Confidence Gate').item.json;
const binaryItems = $input.item.binary || {};
const binKeys = Object.keys(binaryItems);   

// ── Binary resolution (n8n 2.x Buffer handling) ──────────────
const propName = binaryItems.data ? 'data' : (binKeys.length > 0 ? binKeys[0] : null);
if (!propName) {
  throw new Error('[Compositor] No binary found in input. Available keys: ' + binKeys.join(', '));
}

const testBuf = await this.helpers.getBinaryDataBuffer(0, propName);
if (!testBuf || testBuf.length < 100) {
  throw new Error(`[Compositor] Binary is only ${testBuf ? testBuf.length : 0} bytes — download failed or URL expired.`);
}

// Support JPEG & PNG magic bytes
const isPng = [0x89, 0x50, 0x4E, 0x47].every((b, i) => testBuf[i] === b);
const isJpeg = [0xFF, 0xD8, 0xFF].every((b, i) => testBuf[i] === b);
if (!isPng && !isJpeg) {
  const hex = Array.from(testBuf.slice(0, 4)).map(b => b.toString(16).padStart(2,'0')).join(' ');
  throw new Error(`[Compositor] Unsupported format (magic: ${hex}). WaveSpeed may have returned an error page.`);
}

// ---- Extract card data ----
const headline = (geminiData.headline || 'AI NEWS TODAY').toUpperCase().trim();
const highlights = (geminiData.headline_highlights || []).map(h => h.toUpperCase().trim());
const brandName = 'HYPERSCALER';
const subreddit = geminiData.subreddit || '';

// ---- Build SVG overlay ----
const W = 1080;
const H = 1350;

function xmlEscape(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function colorizeWords(text, highlights) {
  const words = text.split(' ');
  return words.map(word => {
    const clean = word.replace(/[^A-Z0-9]/g, '');
    const isCyan = highlights.some(h => h.includes(clean) || clean.includes(h.replace(/[^A-Z0-9]/g, '')));
    return { word, isCyan };
  });
}

function wrapWords(colorWords, maxCharsPerLine) {
  const lines = [];
  let currentLine = [];
  let currentLen = 0;
  for (const cw of colorWords) {
    if (currentLen + cw.word.length + (currentLine.length > 0 ? 1 : 0) > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [cw];
      currentLen = cw.word.length;
    } else {
      if (currentLine.length > 0) currentLen += 1;
      currentLen += cw.word.length;
      currentLine.push(cw);
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);
  return lines;
}

const colorWords = colorizeWords(headline, highlights);
// V8: Increased char limit to 22 to allow 3-4 words per line
const wrappedLines = wrapWords(colorWords, 22);

const lineCount = wrappedLines.length;
// V8: More aggressive scaling for larger lines
const baseFontSize = lineCount >= 4 ? 75 : (lineCount >= 3 ? 88 : 100);
const lineHeight = baseFontSize * 1.1;
const totalTextHeight = lineCount * lineHeight;

// Position ensemble in lower third/bottom
const bottomMargin = 120;
const startY = H - bottomMargin - totalTextHeight + baseFontSize; 
const brandY = startY - baseFontSize - 80;

let textSvg = '';
wrappedLines.forEach((line, lineIdx) => {
  const y = startY + (lineIdx * lineHeight);
  textSvg += `<text x="${W/2}" y="${y}" font-family="'Arial Black', 'Impact', sans-serif" font-size="${baseFontSize}" font-weight="900" text-anchor="middle" letter-spacing="-2">`;
  line.forEach((cw, wi) => {
    const color = cw.isCyan ? '#00D4FF' : '#FFFFFF';
    const space = (wi < line.length - 1) ? ' ' : '';
    textSvg += `<tspan fill="${color}">${xmlEscape(cw.word)}${space}</tspan>`;
  });
  textSvg += `</text>`;
});

const GRAD_START_FRAC = 0.35;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="darkGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="${GRAD_START_FRAC}" stop-color="#000000" stop-opacity="0"/>
      <stop offset="0.68" stop-color="#060810" stop-opacity="0.95"/>
      <stop offset="1" stop-color="#000000" stop-opacity="1"/>
    </linearGradient>
    <filter id="textShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.9"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="${W}" height="${H}" fill="url(#darkGrad)"/>
  
  <!-- GETINTOAI Style Brand Divider -->
  <line x1="120" y1="${brandY}" x2="${W/2 - 140}" y2="${brandY}" stroke="#FFFFFF" stroke-width="1.5" opacity="0.6"/>
  <text x="${W/2}" y="${brandY + 8}" font-family="'Arial', sans-serif" font-size="24" font-weight="500" fill="#FFFFFF" text-anchor="middle" letter-spacing="4" filter="url(#textShadow)">${xmlEscape(brandName)}</text>
  <line x1="${W/2 + 140}" y1="${brandY}" x2="${W - 120}" y2="${brandY}" stroke="#FFFFFF" stroke-width="1.5" opacity="0.6"/>
  
  <rect x="50" y="50" width="180" height="44" rx="22" fill="#00D4FF" opacity="0.15"/>
  <rect x="50" y="50" width="180" height="44" rx="22" fill="none" stroke="#00D4FF" stroke-width="1.5" opacity="0.8"/>
  <text x="140" y="79" font-family="'Arial', sans-serif" font-size="20" font-weight="600" fill="#00D4FF" text-anchor="middle" letter-spacing="1">r/${xmlEscape(subreddit)}</text>
  <g filter="url(#textShadow)">${textSvg}</g>
</svg>`;

const svgBase64 = Buffer.from(svg).toString('base64');
const bgBase64 = testBuf.toString('base64');

return [{
  json: { 
    ...geminiData, 
    compositor_mode: 'svg_overlay', 
    svg_overlay_base64: svgBase64, 
    bg_image_base64: bgBase64, 
    image_source: 'wavespeed_seedream' 
  },
  binary: {
    bg_image: binaryItems[propName] || { data: bgBase64, mimeType: isPng ? 'image/png' : 'image/jpeg', fileName: 'background.' + (isPng ? 'png' : 'jpg') },
    svg_overlay: { data: svgBase64, mimeType: 'image/svg+xml', fileName: 'overlay.svg' }
  }
}];"""

def patch_json(filepath):
    with open(filepath, 'r') as f:
        data = json.load(f)

    found = False
    for node in data.get('nodes', []):
        if node.get('id') == 'node-compositor':
            node['parameters']['jsCode'] = new_js_code
            print(f"Patched node: {node.get('name')}")
            found = True
            break
    
    if not found:
        print("Node 'node-compositor' not found!")
        return
            
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=4)

if __name__ == "__main__":
    patch_json('/home/sandesh-neupane/nepali-congress-n8n/agentic_ai_briefing.json')
