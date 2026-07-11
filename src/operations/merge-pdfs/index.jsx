import { useState } from 'react'
import Dropzone from '../../components/Dropzone.jsx'
import FileList from '../../components/FileList.jsx'
import Progress from '../../components/Progress.jsx'
import Note from '../../components/Note.jsx'
import Icon from '../../components/Icon.jsx'
import DownloadButton from '../../components/DownloadButton.jsx'
import { useJob } from '../../hooks/useJob.js'
import { mergePdfs } from './helpers.js'

export default function MergePdfs() {
  const [files, setFiles] = useState([])
  const [warning, setWarning] = useState(null)
  const { running, progress, error, setError, result, run, reset } = useJob();

  const add = (incoming) => {
    const isPdf = (f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name);
    const isSameFile = (a, b) => a.name === b.name && a.size === b.size;

    const skipped = [];
    const accepted = [];

    incoming.forEach((f) => {
      if (!isPdf(f)) return; //ignore the non pdf files

      const alreadyInList = files.some((existing) => isSameFile(existing, f));
      const alreadyAcceptedThisBatch = accepted.some((added) => isSameFile(added, f));

      if (alreadyInList || alreadyAcceptedThisBatch) {
        skipped.push(f.name);
      } else {
        accepted.push(f);
      }
    });

    reset();

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
      setWarning(null); // clear any old warning if this batch was clean
    }
  };

  const move = (from, to) =>
    setFiles((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })

  const merge = () => run((p) => mergePdfs(files, p).then((blob) => ({ blob, filename: 'merged.pdf' })))

  return (
    <div className="space-y-6">
      <Dropzone onFiles={add} accept="application/pdf,.pdf" label="Drop PDFs here or click to browse" hint="Add two or more PDFs, then drag to reorder" icon="fileText" />

      {files.length > 0 && (
        <>
          <FileList files={files} onMove={move} onRemove={(i) => setFiles((p) => p.filter((_, idx) => idx !== i))} onClear={() => { setFiles([]); reset() }} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={merge} disabled={running || files.length < 2}>
              <Icon name="layers" className="h-4 w-4" />
              Merge {files.length > 1 ? `${files.length} PDFs` : 'PDFs'}
            </button>
            {result && <DownloadButton result={result} />}
          </div>
        </>
      )}

      {running && progress && <Progress value={progress.value} message={progress.message} />}
      {error && <Note type="error" title="Merge failed">{error}</Note>}
      {warning && <Note type="warning" title="Heads up">{warning}</Note>}
    </div>
  )
}
