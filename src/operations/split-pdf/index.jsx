import { useState } from 'react'
import Dropzone from '../../components/Dropzone.jsx'
import Progress from '../../components/Progress.jsx'
import Note from '../../components/Note.jsx'
import Icon from '../../components/Icon.jsx'
import ResultGallery from '../../components/ResultGallery.jsx'
import { useJob } from '../../hooks/useJob.js'
import { formatBytes, baseName } from '../../lib/format.js'
import { splitPdf } from './helpers.js'
import { usePdfPageCount } from '../../hooks/usePdfPageCount.js'

export default function SplitPdf() {
  const [file, setFile] = useState(null)
  const [mode, setMode] = useState('explode')
  const [ranges, setRanges] = useState('')
  const { running, progress, error, result, run, reset } = useJob()
  const { pageCount } = usePdfPageCount(file)

  const pick = (files) => {
    setFile(files[0])
    reset()
  }
  const go = () => run((p) => splitPdf(file, { mode, ranges }, p))

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

          <div className="card space-y-4 p-4">
            <fieldset className="space-y-2">
              <legend className="field-label mb-1">Mode</legend>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="mode" checked={mode === 'explode'} onChange={() => setMode('explode')} />
                Explode — one PDF per page
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" name="mode" checked={mode === 'ranges'} onChange={() => setMode('ranges')} />
                Page ranges — one PDF per range
              </label>
            </fieldset>
            {mode === 'ranges' && (
              <label className="block space-y-1">
                <span className="field-label">Ranges (comma-separated groups)</span>
                <input className="field-input" placeholder="e.g. 1-3, 4-6, 7" value={ranges} onChange={(e) => setRanges(e.target.value)} />
                <span className="text-xs text-slate-500">Each group becomes a separate output file.</span>
              </label>
            )}
          </div>

          <button type="button" className="btn-primary" onClick={go} disabled={running}>
            <Icon name="scissors" className="h-4 w-4" />
            Split PDF
          </button>
        </>
      )}

      {running && progress && <Progress value={progress.value} message={progress.message} />}
      {error && <Note type="error" title="Split failed">{error}</Note>}
      {result && !running && <ResultGallery results={result} preview={false} zipName={`${baseName(file?.name || 'split')}-split.zip`} />}
    </div>
  )
}
