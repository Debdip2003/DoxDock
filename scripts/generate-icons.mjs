// Generates DoxDock PWA icons as PNGs with zero image dependencies.
// A tiny hand-rolled PNG encoder (RGBA -> deflate via built-in zlib) draws a
// document glyph on a brand-colored background. Run: npm run gen:icons
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(OUT, { recursive: true })

// --- CRC32 (for PNG chunks) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const body = Buffer.concat([typeBuf, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  // filter byte 0 per scanline
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]
const BG = hex('#4f46e5')
const BG2 = hex('#4338ca')
const PAGE = hex('#ffffff')
const LINE = hex('#a5b4fc')

function draw(size) {
  const buf = Buffer.alloc(size * size * 4)
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = (y * size + x) * 4
    buf[i] = r
    buf[i + 1] = g
    buf[i + 2] = b
    buf[i + 3] = a
  }
  // background with a subtle vertical gradient
  for (let y = 0; y < size; y++) {
    const t = y / size
    const c = [
      Math.round(BG[0] + (BG2[0] - BG[0]) * t),
      Math.round(BG[1] + (BG2[1] - BG[1]) * t),
      Math.round(BG[2] + (BG2[2] - BG[2]) * t),
    ]
    for (let x = 0; x < size; x++) set(x, y, c)
  }
  // page geometry
  const px = Math.round(size * 0.28)
  const pw = Math.round(size * 0.44)
  const py = Math.round(size * 0.22)
  const ph = Math.round(size * 0.56)
  const fold = Math.round(size * 0.13) // folded corner size
  const inPage = (x, y) => x >= px && x < px + pw && y >= py && y < py + ph
  // folded top-right corner: cut a triangle out of the page
  const inFoldCut = (x, y) => {
    const rx = px + pw - x
    const ry = y - py
    return ry < fold && rx < fold && ry + rx < fold
  }
  for (let y = py; y < py + ph; y++) {
    for (let x = px; x < px + pw; x++) {
      if (inFoldCut(x, y)) continue
      set(x, y, PAGE)
    }
  }
  // the fold flap (small darker triangle)
  for (let y = py; y < py + fold; y++) {
    for (let x = px + pw - fold; x < px + pw; x++) {
      const rx = px + pw - x
      const ry = y - py
      if (ry + rx >= fold && ry < fold && rx < fold) set(x, y, LINE)
    }
  }
  // text lines
  const lh = Math.max(2, Math.round(size * 0.03))
  const lines = [0.42, 0.55, 0.68]
  for (const ly of lines) {
    const y0 = Math.round(size * ly)
    const lx = px + Math.round(pw * 0.16)
    const lw = Math.round(pw * 0.68)
    for (let y = y0; y < y0 + lh; y++)
      for (let x = lx; x < lx + lw; x++) if (inPage(x, y)) set(x, y, LINE)
  }
  return encodePNG(size, size, buf)
}

writeFileSync(join(OUT, 'pwa-192.png'), draw(192))
writeFileSync(join(OUT, 'pwa-512.png'), draw(512))
writeFileSync(join(OUT, 'apple-touch-icon-180.png'), draw(180))

// SVG favicon (crisp at any size, fully local)
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#4f46e5"/>
  <path d="M32 22h26l12 12v44a4 4 0 0 1-4 4H32a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4z" fill="#fff"/>
  <path d="M58 22l12 12H58z" fill="#a5b4fc"/>
  <g fill="#a5b4fc"><rect x="37" y="46" width="26" height="4" rx="2"/><rect x="37" y="56" width="26" height="4" rx="2"/><rect x="37" y="66" width="18" height="4" rx="2"/></g>
</svg>`
writeFileSync(join(OUT, 'favicon.svg'), favicon)

console.log('Generated icons in public/: pwa-192.png, pwa-512.png, apple-touch-icon-180.png, favicon.svg')
