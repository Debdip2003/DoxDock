import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { loadPdf } from '../../lib/pdfjs.js'

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return rgb(0, 0, 0)
  const n = parseInt(m[1], 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

/** Load a pdf.js document from bytes (uses a copy so the original stays intact for export). */
export function openForRender(bytes) {
  return loadPdf(bytes.slice(0))
}

/**
 * Render one page into a canvas at a CSS width. Returns page point-size + the
 * px-per-point scale used, so annotation coordinates (stored in points) map to
 * on-screen pixels.
 */
export async function renderPage(pdfjsDoc, pageNumber, canvas, cssWidth) {
  const page = await pdfjsDoc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const widthPt = base.width
  const heightPt = base.height
  const scale = cssWidth / widthPt
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const viewport = page.getViewport({ scale: scale * dpr })
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${heightPt * scale}px`
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // Cancel any in-flight render on this canvas (StrictMode double-invoke safety).
  if (canvas.__task) {
    try {
      canvas.__task.cancel()
    } catch {
      /* ignore */
    }
  }
  const task = page.render({ canvasContext: ctx, viewport })
  canvas.__task = task
  try {
    await task.promise
  } catch (e) {
    if (e?.name === 'RenderingCancelledException') return null
    throw e
  } finally {
    if (canvas.__task === task) canvas.__task = null
    page.cleanup?.()
  }
  return { widthPt, heightPt, scale }
}

/** Prepare an image file for placement: keep JPEG/PNG as-is, transcode others to PNG. */
export async function prepareImage(file) {
  const type = (file.type || '').toLowerCase()
  let bytes = new Uint8Array(await file.arrayBuffer())
  let mime = type
  if (type !== 'image/png' && type !== 'image/jpeg' && type !== 'image/jpg') {
    const bmp = await createImageBitmap(new Blob([bytes], { type: type || 'image/*' }))
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    c.getContext('2d').drawImage(bmp, 0, 0)
    bmp.close?.()
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
    bytes = new Uint8Array(await blob.arrayBuffer())
    mime = 'image/png'
  }
  const url = URL.createObjectURL(new Blob([bytes.slice(0)], { type: mime }))
  const dims = await new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => rej(new Error('Could not read that image.'))
    img.src = url
  })
  return { bytes, mime, url, naturalW: dims.w, naturalH: dims.h }
}

/**
 * Bake all annotations into the original PDF and return a Blob.
 * Annotation coordinates are in PDF points with a top-left origin.
 */
export async function exportEditedPdf(origBytes, annotations, onProgress) {
  onProgress?.(0.2, 'Opening PDF…')
  const doc = await PDFDocument.load(origBytes)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pages = doc.getPages()
  const imgCache = new Map()

  const list = [...annotations].sort((a, b) => a.page - b.page)
  for (let i = 0; i < list.length; i++) {
    const a = list[i]
    const page = pages[a.page]
    if (!page) continue
    onProgress?.(0.3 + (0.6 * i) / list.length, 'Applying edits…')
    const H = page.getHeight()

    if (a.type === 'text') {
      const size = a.fontSize
      const color = hexToRgb(a.color)
      const lines = String(a.text || '').split('\n')
      lines.forEach((line, li) => {
        page.drawText(line, {
          x: a.x,
          y: H - a.y - size - li * size * 1.25,
          size,
          font,
          color,
        })
      })
    } else if (a.type === 'draw') {
      if (a.points.length < 2) continue
      const d = a.points.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')
      page.drawSvgPath(d, {
        x: 0,
        y: H,
        borderColor: hexToRgb(a.color),
        borderWidth: a.width,
      })
    } else if (a.type === 'highlight') {
      page.drawRectangle({ x: a.x, y: H - a.y - a.h, width: a.w, height: a.h, color: hexToRgb(a.color), opacity: 0.35 })
    } else if (a.type === 'whiteout') {
      page.drawRectangle({ x: a.x, y: H - a.y - a.h, width: a.w, height: a.h, color: rgb(1, 1, 1) })
    } else if (a.type === 'rect') {
      page.drawRectangle({ x: a.x, y: H - a.y - a.h, width: a.w, height: a.h, borderColor: hexToRgb(a.color), borderWidth: a.width })
    } else if (a.type === 'ellipse') {
      page.drawEllipse({ x: a.x + a.w / 2, y: H - (a.y + a.h / 2), xScale: a.w / 2, yScale: a.h / 2, borderColor: hexToRgb(a.color), borderWidth: a.width })
    } else if (a.type === 'line') {
      page.drawLine({ start: { x: a.x1, y: H - a.y1 }, end: { x: a.x2, y: H - a.y2 }, thickness: a.width, color: hexToRgb(a.color) })
    } else if (a.type === 'image') {
      let img = imgCache.get(a.id)
      if (!img) {
        img = a.mime === 'image/png' ? await doc.embedPng(a.bytes) : await doc.embedJpg(a.bytes)
        imgCache.set(a.id, img)
      }
      page.drawImage(img, { x: a.x, y: H - a.y - a.h, width: a.w, height: a.h })
    }
  }

  onProgress?.(0.95, 'Saving…')
  const out = await doc.save()
  onProgress?.(1, 'Done')
  return new Blob([out], { type: 'application/pdf' })
}
