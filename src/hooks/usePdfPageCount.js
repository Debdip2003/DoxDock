import { useEffect, useState } from 'react'
import { PDFDocument } from 'pdf-lib'

// Reads just the page count from a selected PDF File — no other parsing.
// Runs once per file selection so operations can show "N pages" up front.
export function usePdfPageCount(file) {
  const [pageCount, setPageCount] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!file) {
      setPageCount(null)
      setError(null)
      return
    }
    let cancelled = false
    setPageCount(null)
    setError(null)

    file
      .arrayBuffer()
      .then((bytes) => PDFDocument.load(bytes))
      .then((doc) => {
        if (!cancelled) setPageCount(doc.getPageCount())
      })
      .catch(() => {
        if (!cancelled) setError('Could not read page count.')
      })

    return () => {
      cancelled = true
    }
  }, [file])

  return { pageCount, error }
}