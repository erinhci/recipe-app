import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Icon from '../components/Icon'
import Working from '../components/Working'
import { useOnline } from '../lib/useOnline'
import { draftToForm, importImages, importPdf, importUrl, prepareImages, textToForm } from '../lib/importRecipe'

const hasRecipe = (draft) => Boolean(draft && (draft.ingredients?.length || draft.ingredient_lines?.length || draft.steps?.length))

// Pick a source, read it, then open the review screen with the result
// and the original side by side. Gemini does the reading when online;
// if it's unavailable, the phone can read the text itself.
const isPdf = (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name)

// Pick a source and it's read right away, then the review screen opens
// with the result and the original side by side. Gemini does the reading
// when online; if it's unavailable, the phone can read the text itself.
export default function Import() {
  const navigate = useNavigate()
  const online = useOnline()

  const [files, setFiles] = useState(null) // { kind: 'images' | 'pdf', list }
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState('') // which source is working
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState('')
  const [failure, setFailure] = useState(null) // { source, message }

  function review(form, originals, method) {
    navigate('/recipe/new', { state: { form, originals, method } })
  }

  async function readWithGemini(source, chosen = files) {
    setFailure(null)
    setBusy(source)
    setStatus('Gemini is reading the recipe…')
    try {
      if (source === 'file' && chosen.kind === 'images') {
        const blobs = await prepareImages(chosen.list)
        const result = await importImages(blobs)
        if (result.ok && hasRecipe(result.draft)) {
          return review(draftToForm(result.draft), { kind: 'images', files: blobs }, 'gemini')
        }
        throw Object.assign(new Error(result.ok ? 'No recipe was found in those images.' : result.message), result)
      }
      if (source === 'file' && chosen.kind === 'pdf') {
        const [pdf] = chosen.list
        const result = await importPdf(pdf, setStatus)
        if (result.ok && hasRecipe(result.draft)) {
          return review(draftToForm(result.draft), { kind: 'pdf', files: [pdf] }, 'gemini')
        }
        throw Object.assign(new Error(result.ok ? 'No recipe was found in that PDF.' : result.message), result)
      }
      if (source === 'url') {
        const address = String(chosen ?? '').trim()
        const result = await importUrl(address)
        if (result.ok && hasRecipe(result.draft)) {
          return review(draftToForm(result.draft), { kind: 'url', url: address }, result.method)
        }
        throw Object.assign(new Error(result.ok ? 'No recipe was found on that page.' : result.message), result)
      }
    } catch (error) {
      setStatus('')
      setFailure({ source, message: error.message, status: error.status })
    } finally {
      setBusy('')
    }
  }

  async function readOnPhone(chosen = files) {
    setFailure(null)
    setBusy('file')
    try {
      if (chosen.kind === 'images') {
        setStatus('Reading the text on this phone…')
        setProgress('the first time downloads about 4 MB')
        const { readImageText } = await import('../lib/readers')
        const blobs = await prepareImages(chosen.list)
        const text = await readImageText(blobs, (p) => setProgress(`${Math.round(p * 100)}% read`))
        return review(textToForm(text), { kind: 'images', files: blobs }, 'on-phone')
      }
      setStatus('Reading the PDF on this phone.')
      const { readPdfText } = await import('../lib/readers')
      const [pdf] = chosen.list
      const text = await readPdfText(pdf)
      if (!text) {
        throw new Error(
          'This PDF is a scanned image, so its text can only be read by Gemini. Try again when Gemini is available, or take a screenshot.',
        )
      }
      return review(textToForm(text), { kind: 'pdf', files: [pdf] }, 'on-phone')
    } catch (error) {
      setStatus('')
      setFailure({ source: 'file', message: error.message, onPhoneFailed: true })
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  // Choosing is the action: reading starts as soon as files are picked
  // (the card says so, per WCAG 3.2.2). A PDF wins over images picked with it.
  function chooseFiles(event) {
    const list = [...event.target.files]
    event.target.value = ''
    if (!list.length) return
    const pdf = list.find(isPdf)
    const chosen = pdf ? { kind: 'pdf', list: [pdf] } : { kind: 'images', list: list.slice(0, 6) }
    setFiles(chosen)
    if (online) readWithGemini('file', chosen)
    else readOnPhone(chosen)
  }

  const validUrl = (text) => /^https?:\/\/\S+\.\S+$/.test(text.trim())

  // One field for both: a link is read by Gemini, anything else is sorted
  // on the phone. A pasted link is read right away; typed text waits for
  // the arrow.
  function pasteIntoField(event) {
    const text = event.clipboardData?.getData('text') ?? ''
    if (!validUrl(text) || !online || busy || pasted.trim()) return
    event.preventDefault()
    setPasted(text.trim())
    readWithGemini('url', text.trim())
  }

  function submitField(event) {
    event.preventDefault()
    const text = pasted.trim()
    if (!text) return
    if (validUrl(text)) {
      if (online) readWithGemini('url', text)
      else setFailure({ source: 'url', message: 'Links need a connection. Paste the recipe text instead, or try again online.' })
      return
    }
    review(textToForm(pasted), { kind: 'text' }, 'pasted')
  }

  const failureBlock = (source) =>
    failure?.source === source && (
      <div role="alert" style={{ marginTop: 'var(--space-3)' }}>
        <p className="error">{failure.message}</p>
        {source === 'file' && files && !failure.onPhoneFailed && (
          <button className="btn btn-secondary" type="button" onClick={() => readOnPhone()} disabled={!!busy}>
            Read it on this phone instead
          </button>
        )}
      </div>
    )

  const chosenText =
    files && (files.kind === 'pdf' ? files.list[0].name : `${files.list.length} ${files.list.length === 1 ? 'image' : 'images'}`)

  return (
    <Page title="Add a recipe">
      <p className="meta" style={{ fontSize: 'var(--text-md)' }}>
        Bring it in however you have it. You check it before it's saved.
      </p>
      {!online && (
        <p className="hint">
          You're offline. Links and Gemini need a connection, but this phone can still read screenshots and text PDFs, and you can paste or
          type a recipe.
        </p>
      )}

      {busy && status && (
        <Working label={status} typical={busy === 'url' ? 'a few seconds' : '5 to 15 seconds'} detail={progress} slowAfter={30} />
      )}

      <form className="smart-add" onSubmit={submitField}>
        <label htmlFor="pasted" className="smart-label">
          Paste a link or the recipe
        </label>
        <div className="smart-field">
          <textarea
            id="pasted"
            rows={4}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            onPaste={pasteIntoField}
            aria-describedby="pasted-hint"
            placeholder="https://… or the whole recipe"
          />
          <button className="smart-go" type="submit" aria-label={busy === 'url' ? 'Reading' : 'Read recipe'} disabled={!pasted.trim() || !!busy}>
            <Icon name="arrow" size={22} />
          </button>
        </div>
        <p id="pasted-hint" className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
          {online ? 'Links read right away. Pasted text works offline.' : 'Pasted text works offline. Links need a connection.'}
        </p>
        {failureBlock('url')}
      </form>

      <section aria-labelledby="from-heading" className="add-from">
        <h2 id="from-heading" className="hint" style={{ fontSize: 'var(--text-sm)', margin: '0 0 var(--space-2)' }}>
          Or add from
        </h2>
        <p className="sr-only" id="file-hint">
          Reading starts as soon as you choose.
        </p>
        <div className="source-tiles">
          {[
            { id: 'camera', icon: 'camera', name: 'Camera', note: 'Snap the page', accept: 'image/*', capture: 'environment' },
            { id: 'photos', icon: 'image', name: 'Photos', note: 'Up to 6', accept: 'image/*', multiple: true },
            { id: 'pdf', icon: 'file', name: 'PDF', note: 'One file', accept: 'application/pdf' },
          ].map((source) => (
            <label key={source.id} className={`source-tile${busy ? ' is-busy' : ''}`} aria-disabled={busy ? true : undefined}>
              <input
                className="sr-only"
                type="file"
                accept={source.accept}
                capture={source.capture}
                multiple={source.multiple}
                aria-describedby="file-hint"
                disabled={!!busy}
                onChange={chooseFiles}
              />
              <Icon name={source.icon} size={26} />
              <span className="source-text">
                <span className="source-name">{source.name}</span>
                <span className="source-note">{source.note}</span>
              </span>
            </label>
          ))}
        </div>
        {busy === 'file' && <p className="hint">Reading {chosenText}…</p>}
        {failureBlock('file')}
      </section>

      <p className="actions center">
        <Link className="link-btn" to="/recipe/new" style={{ display: 'inline-flex', alignItems: 'center' }}>
          Type it in yourself
        </Link>
      </p>
    </Page>
  )
}
