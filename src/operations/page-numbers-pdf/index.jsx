import { useState } from 'react'
import Dropzone from '../../components/Dropzone.jsx'
import Progress from '../../components/Progress.jsx'
import Note from '../../components/Note.jsx'
import Icon from '../../components/Icon.jsx'
import DownloadButton from '../../components/DownloadButton.jsx'
import { useJob } from '../../hooks/useJob.js'
import { formatBytes, baseName } from '../../lib/format.js'
import { addPageNumbers } from './helpers.js'
import { usePdfPageCount } from '../../hooks/usePdfPageCount.js'

export default function PageNumbersPdf() {
  const [file, setFile] = useState(null)
  const [position, setPosition] = useState('bottom-center')
  const [format, setFormat] = useState('n')
  const [fontSize, setFontSize] = useState(11)
  const [start, setStart] = useState(1)
  const { running, progress, error, result, run, reset } = useJob()
  const { pageCount } = usePdfPageCount(file)

  const pick = (files) => {
    setFile(files[0])
    reset()
  }
  const go = () =>
    run((p) =>
      addPageNumbers(file, { position, format, fontSize: Number(fontSize), start: Number(start) }, p).then((blob) => ({
        blob,
        filename: `${baseName(file.name)}-numbered.pdf`,
      })),
    )

  return (
    <div className="space-y-6">
      <Dropzone onFiles={pick} accept="application/pdf,.pdf" multiple={false} label="Drop a PDF here or click to browse" icon="fileText" />

      {file && (
        <>
          <div className="card flex items-center gap-3 p-3">
            <Icon name="fileText" className="h-5 w-5 text-brand-600" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-slate-400">{formatBytes(file.size)}{pageCount != null && ` · ${pageCount} page${pageCount === 1 ? '' : 's'}`}</span>
          </div>

          <div className="card p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="field-label">Position</span>
                <select className="field-input" value={position} onChange={(e) => setPosition(e.target.value)}>
                  <option value="bottom-center">Bottom center</option>
                  <option value="bottom-right">Bottom right</option>
                  <option value="bottom-left">Bottom left</option>
                  <option value="top-center">Top center</option>
                  <option value="top-right">Top right</option>
                  <option value="top-left">Top left</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="field-label">Format</span>
                <select className="field-input" value={format} onChange={(e) => setFormat(e.target.value)}>
                  <option value="n">1, 2, 3…</option>
                  <option value="page-n">Page 1, Page 2…</option>
                  <option value="n-of-total">1 of N…</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="field-label">Font size: {fontSize}pt</span>
                <input type="range" min="8" max="24" value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="w-full accent-brand-600" />
              </label>
              <label className="space-y-1">
                <span className="field-label">Start at</span>
                <input type="number" min="0" className="field-input" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={go} disabled={running}>
              <Icon name="hash" className="h-4 w-4" />
              Add page numbers
            </button>
            {result && <DownloadButton result={result} />}
          </div>
        </>
      )}

      {running && progress && <Progress value={progress.value} message={progress.message} />}
      {error && <Note type="error" title="Couldn’t add page numbers">{error}</Note>}
    </div>
  )
}
