import { PDFDocument } from 'pdf-lib'

/** Merge PDFs (in the given order) into one document. */
export async function mergePdfs(files, onProgress) {
  if (!files || files.length < 2) throw new Error('Add at least two PDFs to merge.')
  const out = await PDFDocument.create()
  for (let i = 0; i < files.length; i++) {
    onProgress?.(i / files.length, `Merging ${files[i].name} (${i + 1}/${files.length})…`)
    let src
    try {
      src = await PDFDocument.load(await files[i].arrayBuffer())
    } catch {
      throw new Error(`Could not read "${files[i].name}". Is it a valid PDF? Encrypted PDFs are not supported.`)
    }
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  onProgress?.(1, 'Finalizing…')
  const bytes = await out.save()
  return new Blob([bytes], { type: 'application/pdf' })
}
