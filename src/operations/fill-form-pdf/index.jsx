import { useState } from 'react'
import Dropzone from '../../components/Dropzone.jsx'
import Progress from '../../components/Progress.jsx'
import Note from '../../components/Note.jsx'
import Icon from '../../components/Icon.jsx'
import DownloadButton from '../../components/DownloadButton.jsx'
import { useJob } from '../../hooks/useJob.js'
import { baseName, formatBytes } from '../../lib/format.js'
import { readFields, fillForm } from './helpers.js'

export default function FillFormPdf() {
  const [file, setFile] = useState(null)
  const [fields, setFields] = useState(null)
  const [flatten, setFlatten] = useState(true)
  const readJob = useJob()
  const fillJob = useJob()

  const pick = async (files) => {
    const f = files[0]
    setFile(f)
    setFields(null)
    fillJob.reset()
    const result = await readJob.run(() => readFields(f))
    if (result) {
      const map = {}
      result.forEach((fld) => (map[fld.name] = fld))
      setFields(map)
    }
  }

  const update = (name, value) => setFields((prev) => ({ ...prev, [name]: { ...prev[name], value } }))
  const apply = () =>
    fillJob.run((p) => fillForm(file, fields, flatten, p).then((blob) => ({ blob, filename: `${baseName(file.name)}-filled.pdf` })))

  return (
    <div className="space-y-6">
      <Dropzone onFiles={pick} accept="application/pdf,.pdf" multiple={false} label="Drop a fillable PDF form here or click to browse" icon="form" />

      {readJob.running && readJob.progress && <Progress value={readJob.progress.value} message={readJob.progress.message} />}
      {readJob.error && <Note type="error" title="Couldn’t read the form">{readJob.error}</Note>}

      {file && fields && (
        <>
          <div className="card flex items-center gap-3 p-3">
            <Icon name="form" className="h-5 w-5 text-brand-600" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{file.name}</span>
            <span className="text-xs text-slate-400">{Object.keys(fields).length} fields · {formatBytes(file.size)}</span>
          </div>

          <div className="card space-y-4 p-4">
            {Object.values(fields).map((f) => (
              <div key={f.name}>
                {f.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!f.value} onChange={(e) => update(f.name, e.target.checked)} />
                    <span className="font-medium">{f.name}</span>
                  </label>
                ) : (
                  <label className="block space-y-1">
                    <span className="field-label">{f.name}</span>
                    {f.type === 'dropdown' || f.type === 'radio' || f.type === 'optionlist' ? (
                      <select className="field-input" value={f.value} onChange={(e) => update(f.name, e.target.value)}>
                        <option value="">— none —</option>
                        {(f.options || []).map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : f.type === 'unsupported' ? (
                      <p className="text-xs text-slate-400">Unsupported field type — left unchanged.</p>
                    ) : (
                      <input className="field-input" value={f.value} onChange={(e) => update(f.name, e.target.value)} />
                    )}
                  </label>
                )}
              </div>
            ))}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
            Flatten form (make values permanent / non-editable)
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={apply} disabled={fillJob.running}>
              <Icon name="check" className="h-4 w-4" />
              Fill form
            </button>
            {fillJob.result && <DownloadButton result={fillJob.result} />}
          </div>
          {fillJob.running && fillJob.progress && <Progress value={fillJob.progress.value} message={fillJob.progress.message} />}
          {fillJob.error && <Note type="error" title="Fill failed">{fillJob.error}</Note>}
        </>
      )}
    </div>
  )
}
