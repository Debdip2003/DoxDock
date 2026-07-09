import { extractPdfText } from '../../lib/extractText.js'

export async function extractText(file, opts, onProgress) {
  const { format = 'text' } = opts || {}
  const pages = await extractPdfText(file, onProgress)
  const nonEmpty = pages.some((p) => p.trim())
  if (!nonEmpty) {
    throw new Error('No text found. This looks like a scanned/image-only PDF — DoxDock does not do OCR.')
  }
  let out
  if (format === 'markdown') {
    out = pages.map((p, i) => `## Page ${i + 1}\n\n${p}`).join('\n\n---\n\n')
  } else {
    out = pages.join('\n\n\f\n\n') // form-feed between pages
  }
  return { text: out, pageCount: pages.length }
}
