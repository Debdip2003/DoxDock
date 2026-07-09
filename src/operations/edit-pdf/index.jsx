import { useState, useRef, useEffect, useCallback } from 'react'
import Dropzone from '../../components/Dropzone.jsx'
import Progress from '../../components/Progress.jsx'
import Note from '../../components/Note.jsx'
import Icon from '../../components/Icon.jsx'
import DownloadButton from '../../components/DownloadButton.jsx'
import { useJob } from '../../hooks/useJob.js'
import { baseName } from '../../lib/format.js'
import { openForRender, renderPage, prepareImage, exportEditedPdf } from './helpers.js'

const TOOLS = [
  { id: 'select', icon: 'cursor', label: 'Select / move' },
  { id: 'text', icon: 'type', label: 'Text' },
  { id: 'draw', icon: 'pencil', label: 'Draw' },
  { id: 'highlight', icon: 'highlighter', label: 'Highlight' },
  { id: 'rect', icon: 'square', label: 'Rectangle' },
  { id: 'ellipse', icon: 'circle', label: 'Ellipse' },
  { id: 'line', icon: 'slash', label: 'Line' },
  { id: 'image', icon: 'image', label: 'Image' },
  { id: 'whiteout', icon: 'eraser', label: 'White-out' },
]
const RESIZABLE = new Set(['rect', 'ellipse', 'highlight', 'whiteout', 'image'])
let uid = 0
const nextId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `a${++uid}_${Date.now()}`

// ── Box-type annotation (text, rect, ellipse, highlight, whiteout, image) ──
function AnnotationBox({ a, scale, selectTool, selected, editing, onSelect, onChange, onEdit, onCommitText }) {
  const drag = useRef(null)
  const ref = useRef(null)

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      const r = document.createRange()
      r.selectNodeContents(ref.current)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(r)
    }
  }, [editing])

  const startMove = (e) => {
    if (!selectTool || editing) return
    e.stopPropagation()
    onSelect(a.id)
    drag.current = { mode: 'move', sx: e.clientX, sy: e.clientY, base: { ...a } }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const startResize = (corner) => (e) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect(a.id)
    drag.current = { mode: corner, sx: e.clientX, sy: e.clientY, base: { ...a } }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }
  const onMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.sx) / scale
    const dy = (e.clientY - d.sy) / scale
    const b = d.base
    if (d.mode === 'move') {
      onChange(a.id, { x: b.x + dx, y: b.y + dy })
      return
    }
    let { x, y, w, h } = b
    if (d.mode.includes('w')) { x = b.x + dx; w = b.w - dx }
    if (d.mode.includes('e')) { w = b.w + dx }
    if (d.mode.includes('n')) { y = b.y + dy; h = b.h - dy }
    if (d.mode.includes('s')) { h = b.h + dy }
    if (w < 6) { w = 6; x = d.mode.includes('w') ? b.x + b.w - 6 : b.x }
    if (h < 6) { h = 6; y = d.mode.includes('n') ? b.y + b.h - 6 : b.y }
    onChange(a.id, { x, y, w, h })
  }
  const onUp = () => {
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }

  const px = { left: a.x * scale, top: a.y * scale }
  const common = {
    position: 'absolute',
    ...px,
    boxSizing: 'border-box',
    cursor: selectTool ? (editing ? 'text' : 'move') : 'default',
    outline: selected ? '1.5px solid #5ea9ff' : 'none',
    outlineOffset: '1px',
  }

  let inner
  if (a.type === 'text') {
    inner = (
      <div
        ref={ref}
        contentEditable={editing}
        suppressContentEditableWarning
        onDoubleClick={() => selectTool && onEdit(a.id)}
        onBlur={(e) => onCommitText(a.id, e.currentTarget.innerText)}
        style={{
          ...common,
          minWidth: 8,
          color: a.color,
          fontSize: a.fontSize * scale,
          lineHeight: 1.25,
          fontFamily: 'system-ui, sans-serif',
          whiteSpace: 'pre-wrap',
          padding: 0,
        }}
        onPointerDown={startMove}
      >
        {a.text}
      </div>
    )
    return inner
  }

  const w = a.w * scale
  const h = a.h * scale
  let visual = {}
  if (a.type === 'rect') visual = { border: `${Math.max(1, a.width * scale)}px solid ${a.color}` }
  else if (a.type === 'ellipse') visual = { border: `${Math.max(1, a.width * scale)}px solid ${a.color}`, borderRadius: '50%' }
  else if (a.type === 'highlight') visual = { background: a.color, opacity: 0.35 }
  else if (a.type === 'whiteout') visual = { background: '#fff', outline: selected ? '1.5px solid #5ea9ff' : '1px dashed #9aa7b8' }

  return (
    <div style={{ ...common, width: w, height: h, ...visual }} onPointerDown={startMove}>
      {a.type === 'image' && <img src={a.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none' }} />}
      {selectTool && selected && RESIZABLE.has(a.type) &&
        ['nw', 'ne', 'sw', 'se'].map((c) => (
          <span
            key={c}
            onPointerDown={startResize(c)}
            style={{
              position: 'absolute',
              width: 11,
              height: 11,
              background: '#fff',
              border: '1px solid #5ea9ff',
              borderRadius: '50%',
              top: c[0] === 'n' ? -6 : undefined,
              bottom: c[0] === 's' ? -6 : undefined,
              left: c[1] === 'w' ? -6 : undefined,
              right: c[1] === 'e' ? -6 : undefined,
              cursor: `${c}-resize`,
            }}
          />
        ))}
    </div>
  )
}

export default function EditPdf() {
  const [file, setFile] = useState(null)
  const bytesRef = useRef(null)
  const [pdfjsDoc, setPdfjsDoc] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [pageIndex, setPageIndex] = useState(0)
  const [dims, setDims] = useState(null) // {widthPt, heightPt, scale}
  const [displayW, setDisplayW] = useState(760)

  const [annos, setAnnos] = useState([])
  const historyRef = useRef([])
  const [tool, setTool] = useState('select')
  const [color, setColor] = useState('#e11d48')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [fontSize, setFontSize] = useState(16)
  const [selectedId, setSelectedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState(null)

  const canvasRef = useRef(null)
  const overlayRef = useRef(null)
  const wrapRef = useRef(null)
  const imgInputRef = useRef(null)
  const loadJob = useJob()
  const exportJob = useJob()

  const commit = useCallback((updater) => {
    setAnnos((prev) => {
      historyRef.current.push(prev)
      return typeof updater === 'function' ? updater(prev) : updater
    })
  }, [])
  const undo = () => {
    const prev = historyRef.current.pop()
    if (prev) {
      setAnnos(prev)
      setSelectedId(null)
      setEditingId(null)
    }
  }

  // responsive width
  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width
      setDisplayW(Math.max(300, Math.min(880, Math.floor(w))))
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [file])

  const pick = async (files) => {
    const f = files[0]
    setFile(f)
    setAnnos([])
    historyRef.current = []
    setSelectedId(null)
    setPageIndex(0)
    exportJob.reset()
    const buf = new Uint8Array(await f.arrayBuffer())
    bytesRef.current = buf
    const doc = await loadJob.run(async () => await openForRender(buf))
    if (doc) {
      setPdfjsDoc(doc)
      setNumPages(doc.numPages)
    }
  }

  // render current page
  useEffect(() => {
    let alive = true
    if (!pdfjsDoc || !canvasRef.current) return
    ;(async () => {
      const d = await renderPage(pdfjsDoc, pageIndex + 1, canvasRef.current, displayW)
      if (alive && d) setDims(d)
    })()
    return () => {
      alive = false
    }
  }, [pdfjsDoc, pageIndex, displayW])

  // delete key
  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && editingId !== selectedId) {
        const el = document.activeElement
        if (el && (el.isContentEditable || el.tagName === 'INPUT')) return
        e.preventDefault()
        commit((prev) => prev.filter((a) => a.id !== selectedId))
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, editingId, commit])

  const scale = dims?.scale || 1
  const localPt = (e) => {
    const r = overlayRef.current.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(dims.widthPt, (e.clientX - r.left) / scale)),
      y: Math.max(0, Math.min(dims.heightPt, (e.clientY - r.top) / scale)),
    }
  }

  const updateAnno = (id, patch) => setAnnos((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))

  // overlay pointer (creation)
  const onOverlayDown = (e) => {
    if (!dims) return
    if (tool === 'select') {
      if (e.target === overlayRef.current) {
        setSelectedId(null)
        setEditingId(null)
      }
      return
    }
    const p = localPt(e)
    if (tool === 'text') {
      const id = nextId()
      commit((prev) => [...prev, { id, type: 'text', page: pageIndex, x: p.x, y: p.y, text: 'Text', fontSize, color }])
      setSelectedId(id)
      setEditingId(id)
      return
    }
    if (tool === 'draw') {
      setDraft({ id: nextId(), type: 'draw', page: pageIndex, points: [p], color, width: strokeWidth })
    } else if (tool === 'line') {
      setDraft({ id: nextId(), type: 'line', page: pageIndex, x1: p.x, y1: p.y, x2: p.x, y2: p.y, color, width: strokeWidth })
    } else {
      // rect/ellipse/highlight/whiteout
      setDraft({ id: nextId(), type: tool, page: pageIndex, x: p.x, y: p.y, w: 0, h: 0, ox: p.x, oy: p.y, color, width: strokeWidth })
    }
    window.addEventListener('pointermove', onOverlayMove)
    window.addEventListener('pointerup', onOverlayUp)
  }
  const onOverlayMove = (e) => {
    setDraft((d) => {
      if (!d) return d
      const p = localPt(e)
      if (d.type === 'draw') return { ...d, points: [...d.points, p] }
      if (d.type === 'line') return { ...d, x2: p.x, y2: p.y }
      const x = Math.min(d.ox, p.x)
      const y = Math.min(d.oy, p.y)
      return { ...d, x, y, w: Math.abs(p.x - d.ox), h: Math.abs(p.y - d.oy) }
    })
  }
  const onOverlayUp = () => {
    window.removeEventListener('pointermove', onOverlayMove)
    window.removeEventListener('pointerup', onOverlayUp)
    setDraft((d) => {
      if (!d) return null
      const ok =
        (d.type === 'draw' && d.points.length > 1) ||
        (d.type === 'line' && (Math.abs(d.x2 - d.x1) > 2 || Math.abs(d.y2 - d.y1) > 2)) ||
        (['rect', 'ellipse', 'highlight', 'whiteout'].includes(d.type) && d.w > 3 && d.h > 3)
      if (ok) {
        const { ox, oy, ...clean } = d
        commit((prev) => [...prev, clean])
        setSelectedId(d.id)
      }
      return null
    })
  }

  const onPickImage = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !dims) return
    try {
      const img = await prepareImage(f)
      const maxW = dims.widthPt * 0.4
      const s = Math.min(1, maxW / img.naturalW)
      const w = img.naturalW * s
      const h = img.naturalH * s
      const id = nextId()
      commit((prev) => [
        ...prev,
        { id, type: 'image', page: pageIndex, x: (dims.widthPt - w) / 2, y: (dims.heightPt - h) / 2, w, h, bytes: img.bytes, mime: img.mime, url: img.url },
      ])
      setTool('select')
      setSelectedId(id)
    } catch (err) {
      alert(err.message)
    }
  }
  const chooseTool = (id) => {
    setTool(id)
    setSelectedId(null)
    setEditingId(null)
    if (id === 'image') imgInputRef.current?.click()
  }

  const doExport = () =>
    exportJob.run((p) => exportEditedPdf(bytesRef.current, annos, p).then((blob) => ({ blob, filename: `${baseName(file.name)}-edited.pdf` })))

  const pageAnnos = annos.filter((a) => a.page === pageIndex)
  const svgAnnos = pageAnnos.filter((a) => a.type === 'draw' || a.type === 'line')
  const boxAnnos = pageAnnos.filter((a) => a.type !== 'draw' && a.type !== 'line')
  const needsStroke = ['draw', 'rect', 'ellipse', 'line'].includes(tool)

  return (
    <div className="space-y-5">
      {!file && (
        <Dropzone onFiles={pick} accept="application/pdf,.pdf" multiple={false} label="Drop a PDF here or click to browse" hint="Then add text, drawings, highlights, shapes, images, or white-out" icon="pencil" />
      )}

      {loadJob.running && loadJob.progress && <Progress message="Opening PDF…" />}
      {loadJob.error && <Note type="error" title="Couldn’t open this PDF">{loadJob.error}</Note>}

      {file && pdfjsDoc && (
        <>
          {/* Toolbar */}
          <div className="card flex flex-wrap items-center gap-2 p-2">
            <div className="flex flex-wrap gap-1">
              {TOOLS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  title={t.label}
                  onClick={() => chooseTool(t.id)}
                  className={
                    'flex h-9 w-9 items-center justify-center rounded-lg transition-colors ' +
                    (tool === t.id ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
                  }
                >
                  <Icon name={t.icon} className="h-[18px] w-[18px]" />
                </button>
              ))}
            </div>

            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

            <label className="flex items-center gap-1.5" title="Color">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-9 cursor-pointer rounded border border-slate-300 bg-transparent p-0.5 dark:border-slate-600" />
            </label>
            {needsStroke && (
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                Width
                <input type="range" min="1" max="12" value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="w-20 accent-brand-600" />
              </label>
            )}
            {tool === 'text' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-500">
                Size
                <input type="number" min="6" max="96" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="field-input h-8 w-16 py-1" />
              </label>
            )}

            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <button type="button" className="btn-ghost h-9 px-2" onClick={undo} disabled={!historyRef.current.length} title="Undo">
              <Icon name="undo" className="h-4 w-4" /> Undo
            </button>
            {selectedId && (
              <button type="button" className="btn-ghost h-9 px-2 text-red-600" onClick={() => { commit((p) => p.filter((a) => a.id !== selectedId)); setSelectedId(null) }}>
                <Icon name="trash" className="h-4 w-4" /> Delete
              </button>
            )}
          </div>

          {/* Page nav */}
          <div className="flex items-center justify-center gap-4 text-sm">
            <button type="button" className="btn-secondary px-3 py-1" disabled={pageIndex === 0} onClick={() => { setPageIndex((i) => Math.max(0, i - 1)); setSelectedId(null) }}>
              <Icon name="arrowUp" className="h-4 w-4 -rotate-90" /> Prev
            </button>
            <span className="tabular-nums text-slate-500">Page {pageIndex + 1} / {numPages}</span>
            <button type="button" className="btn-secondary px-3 py-1" disabled={pageIndex >= numPages - 1} onClick={() => { setPageIndex((i) => Math.min(numPages - 1, i + 1)); setSelectedId(null) }}>
              Next <Icon name="arrowDown" className="h-4 w-4 -rotate-90" />
            </button>
          </div>

          {/* Editor surface */}
          <div ref={wrapRef} className="flex justify-center overflow-auto rounded-xl bg-slate-200/60 p-4 dark:bg-slate-800/40">
            <div className="relative shadow-lg" style={{ width: displayW, height: dims ? dims.heightPt * scale : Math.round(displayW * 1.3) }}>
              <canvas ref={canvasRef} className="absolute left-0 top-0 rounded-sm" />
              <div
                ref={overlayRef}
                onPointerDown={onOverlayDown}
                className="absolute inset-0"
                style={{ cursor: tool === 'select' ? 'default' : 'crosshair', touchAction: 'none' }}
              >
               {dims && (<>
                {/* draw + line + draft as SVG */}
                <svg width={displayW} height={dims.heightPt * scale} className="pointer-events-none absolute inset-0">
                  {svgAnnos.map((a) =>
                    a.type === 'draw' ? (
                      <polyline
                        key={a.id}
                        points={a.points.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')}
                        fill="none"
                        stroke={a.color}
                        strokeWidth={a.width * scale}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ pointerEvents: tool === 'select' ? 'stroke' : 'none', cursor: 'move' }}
                        onPointerDown={(e) => { e.stopPropagation(); setSelectedId(a.id) }}
                        opacity={selectedId === a.id ? 0.7 : 1}
                      />
                    ) : (
                      <line
                        key={a.id}
                        x1={a.x1 * scale} y1={a.y1 * scale} x2={a.x2 * scale} y2={a.y2 * scale}
                        stroke={a.color} strokeWidth={a.width * scale} strokeLinecap="round"
                        style={{ pointerEvents: tool === 'select' ? 'stroke' : 'none', cursor: 'move' }}
                        onPointerDown={(e) => { e.stopPropagation(); setSelectedId(a.id) }}
                        opacity={selectedId === a.id ? 0.6 : 1}
                      />
                    ),
                  )}
                  {draft && draft.type === 'draw' && (
                    <polyline points={draft.points.map((p) => `${p.x * scale},${p.y * scale}`).join(' ')} fill="none" stroke={draft.color} strokeWidth={draft.width * scale} strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {draft && draft.type === 'line' && (
                    <line x1={draft.x1 * scale} y1={draft.y1 * scale} x2={draft.x2 * scale} y2={draft.y2 * scale} stroke={draft.color} strokeWidth={draft.width * scale} strokeLinecap="round" />
                  )}
                </svg>

                {/* box annotations */}
                {boxAnnos.map((a) => (
                  <AnnotationBox
                    key={a.id}
                    a={a}
                    scale={scale}
                    selectTool={tool === 'select'}
                    selected={selectedId === a.id}
                    editing={editingId === a.id}
                    onSelect={setSelectedId}
                    onChange={updateAnno}
                    onEdit={setEditingId}
                    onCommitText={(id, text) => {
                      setEditingId(null)
                      if (!text.trim()) {
                        commit((prev) => prev.filter((x) => x.id !== id))
                        setSelectedId(null)
                      } else {
                        commit((prev) => prev.map((x) => (x.id === id ? { ...x, text } : x)))
                      }
                    }}
                  />
                ))}

                {/* draft box preview */}
                {draft && ['rect', 'ellipse', 'highlight', 'whiteout'].includes(draft.type) && (
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      left: draft.x * scale,
                      top: draft.y * scale,
                      width: draft.w * scale,
                      height: draft.h * scale,
                      border: draft.type === 'rect' || draft.type === 'ellipse' ? `${draft.width * scale}px solid ${draft.color}` : undefined,
                      borderRadius: draft.type === 'ellipse' ? '50%' : 0,
                      background: draft.type === 'highlight' ? draft.color : draft.type === 'whiteout' ? '#fff' : undefined,
                      opacity: draft.type === 'highlight' ? 0.35 : 1,
                    }}
                  />
                )}
               </>)}
              </div>
            </div>
          </div>

          <input ref={imgInputRef} type="file" accept="image/*" className="sr-only" onChange={onPickImage} />

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={doExport} disabled={exportJob.running}>
              <Icon name="download" className="h-4 w-4" /> Apply edits &amp; download
            </button>
            {exportJob.result && <DownloadButton result={exportJob.result} label="Download edited PDF" />}
            <button type="button" className="btn-ghost" onClick={() => { setFile(null); setPdfjsDoc(null); setDims(null) }}>
              Choose another file
            </button>
          </div>
          {exportJob.running && exportJob.progress && <Progress value={exportJob.progress.value} message={exportJob.progress.message} />}
          {exportJob.error && <Note type="error" title="Export failed">{exportJob.error}</Note>}
          <p className="text-xs text-slate-400">Tip: pick a tool, then click or drag on the page. Use Select to move, resize, or delete anything you’ve added.</p>
        </>
      )}
    </div>
  )
}
