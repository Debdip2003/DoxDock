import { useState } from 'react'
import Dropzone from '../../components/Dropzone.jsx'
import FileList from '../../components/FileList.jsx'
import Progress from '../../components/Progress.jsx'
import Note from '../../components/Note.jsx'
import DownloadButton from '../../components/DownloadButton.jsx'
import Icon from '../../components/Icon.jsx'
import { useJob } from '../../hooks/useJob.js'
import { imagesToPdf } from './helpers.js'

export default function ImagesToPdf() {
  const [files, setFiles] = useState([])
  const [pageSize, setPageSize] = useState('fit')
  const [orientation, setOrientation] = useState('auto')
  const [margin, setMargin] = useState(0)
  const [warning, setWarning] = useState(null)
  const { running, progress, error, setError, result, run, reset } = useJob();
  const addFiles = (incoming) => {
    const isImage = (f) => f.type.startsWith("image/");
    const isSameFile = (a, b) => a.name === b.name && a.size === b.size;

    const skipped = [];
    const accepted = [];

    incoming.forEach((f) => {
      if (!isImage(f)) return; // ignore non-image files

      const alreadyInList = files.some((existing) => isSameFile(existing, f));
      const alreadyAcceptedThisBatch = accepted.some((added) => isSameFile(added, f));

      if (alreadyInList || alreadyAcceptedThisBatch) {
        skipped.push(f.name);
      } else {
        accepted.push(f);
      }
    });

    reset(); // clear useJob's error/result/progress

    if (accepted.length > 0) {
      setFiles((prev) => [...prev, ...accepted]);
    }

    if (skipped.length > 0) {
      const unique = [...new Set(skipped)];
      setWarning(
        unique.length === 1
          ? `Skipped duplicate file: ${unique[0]}`
          : `Skipped duplicate files: ${unique.join(', ')}`
      );
    } else {
      setWarning(null);
    }
  };

  const move = (from, to) =>
    setFiles((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  const remove = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i))

  const generate = () =>
    run((onProgress) =>
      imagesToPdf(files, { pageSize, orientation, margin: Number(margin) }, onProgress).then(
        (blob) => ({ blob, filename: 'images.pdf' }),
      ),
    )

  return (
    <div className="space-y-6">
      <Dropzone
        onFiles={addFiles}
        accept="image/*"
        label="Drop images here or click to browse"
        hint="JPEG, PNG, WebP, GIF, BMP — reorder them below after adding"
        icon="imagePlus"
      />

      {files.length > 0 && (
        <>
          <FileList
            files={files}
            onMove={move}
            onRemove={remove}
            onClear={() => {
              setFiles([])
              reset()
            }}
            icon="image"
          />

          <div className="card p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Options
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="field-label">Page size</span>
                <select
                  className="field-input"
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value)}
                >
                  <option value="fit">Fit to image</option>
                  <option value="A4">A4</option>
                  <option value="Letter">Letter</option>
                  <option value="Legal">Legal</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="field-label">Orientation</span>
                <select
                  className="field-input"
                  value={orientation}
                  disabled={pageSize === 'fit'}
                  onChange={(e) => setOrientation(e.target.value)}
                >
                  <option value="auto">Auto (per image)</option>
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="field-label">Margin (pt)</span>
                <input
                  type="number"
                  min="0"
                  max="144"
                  className="field-input"
                  value={margin}
                  onChange={(e) => setMargin(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={generate}
              disabled={running}
            >
              <Icon name="fileText" className="h-4 w-4" />
              Create PDF
            </button>
            {result && <DownloadButton result={result} />}
          </div>
        </>
      )}

      {running && progress && <Progress value={progress.value} message={progress.message} />}
      {error && <Note type="error" title="Couldn’t create the PDF">{error}</Note>}
      {result && !running && (
        <Note type="info">Your PDF is ready — it was generated entirely on this device.</Note>
      )}
      {warning && <Note type="warning" title="Heads up">{warning}</Note>}
    </div>
  )
}
