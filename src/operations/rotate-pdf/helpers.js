import { PDFDocument, degrees } from 'pdf-lib'
import { parsePageRanges } from '../../lib/format.js'

/**
 * @param {File} file
 * @param {{angle:number, range:string}} opts  angle in {90,180,270}; empty range = all pages
 */
export async function rotatePdf(file, opts, onProgress) {
  const { angle = 90, range = '' } = opts || {}
  let doc
  try {
    doc = await PDFDocument.load(await file.arrayBuffer())
  } catch {
    throw new Error('Could not read this PDF. Encrypted PDFs are not supported.')
  }
  const total = doc.getPageCount()
  const targets = range.trim() ? parsePageRanges(range, total) : Array.from({ length: total }, (_, i) => i + 1)
  if (!targets.length) throw new Error('No pages selected in that range.')

  const set = new Set(targets)
  const pages = doc.getPages()
  for (let i = 0; i < pages.length; i++) {
    if (!set.has(i + 1)) continue
    onProgress?.(i / pages.length, `Rotating page ${i + 1}…`)
    const current = pages[i].getRotation().angle || 0
    pages[i].setRotation(degrees((current + Number(angle)) % 360))
  }
  onProgress?.(1, 'Saving…')
  const bytes = await doc.save()
  return new Blob([bytes], { type: 'application/pdf' })
}
