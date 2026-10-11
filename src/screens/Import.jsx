import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Page from '../components/Page'
import Working from '../components/Working'
import { useOnline } from '../lib/useOnline'
import {
  draftToForm,
  importImages,
  importPdf,
  importUrl,
  prepareImages,
  textToForm,
} from '../lib/importRecipe'

const hasRecipe = (draft) =>
  Boolean(draft && (draft.ingredients?.length || draft.ingredient_lines?.length || draft.steps?.length))

// Pick a source, read it, then open the review screen with the result
// and the original side by side. Gemini does the reading when online;
// if it's unavailable, the phone can read the text itself.
export default function Import() {
  const navigate = useNavigate()
  const online = useOnline()

  const [images, setImages] = useState([])
  const [pdf, setPdf] = useState(null)
  const [url, setUrl] = useState('')
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState('') // which source is working
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState('')
  const [failure, setFailure] = useState(null) // { source, message }

  function review(form, originals, method) {
    navigate('/recipe/new', { state: { form, originals, method } })
  }

  async function readWithGemini(source) {
    setFailure(null)
    setBusy(source)
    setStatus('Gemini is reading the recipe…')
    try {
      if (source === 'images') {
        const blobs = await prepareImages(images)
        const result = await importImages(blobs)
        if (result.ok && hasRecipe(result.draft)) {
          return review(draftToForm(result.draft), { kind: 'images', files: blobs }, 'gemini')
        }
        throw Object.assign(new Error(result.ok ? 'No recipe was found in those images.' : result.message), result)
      }
      if (source === 'pdf') {
        const result = await importPdf(pdf, setStatus)
        if (result.ok && hasRecipe(result.draft)) {
          return review(draftToForm(result.draft), { kind: 'pdf', files: [pdf] }, 'gemini')
        }
        throw Object.assign(new Error(result.ok ? 'No recipe was found in that PDF.' : result.message), result)
      }
      if (source === 'url') {
        const result = await importUrl(url.trim())
        if (result.ok && hasRecipe(result.draft)) {
          return review(draftToForm(result.draft), { kind: 'url', url: url.trim() }, result.method)
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

  async function readOnPhone(source) {
    setFailure(null)
    setBusy(source)
    try {
      if (source === 'images') {
        setStatus('Reading the text on this phone…')
        setProgress('the first time downloads about 4 MB')
        const { readImageText } = await import('../lib/readers')
        const blobs = await prepareImages(images)
        const text = await readImageText(blobs, (p) => setProgress(`${Math.round(p * 100)}% read`))
        return review(textToForm(text), { kind: 'images', files: blobs }, 'on-phone')
      }
      if (source === 'pdf') {
        setStatus('Reading the PDF on this phone.')
        const { readPdfText } = await import('../lib/readers')
        const text = await readPdfText(pdf)
        if (!text) {
          throw new Error(
            'This PDF is a scanned image, so its text can only be read by Gemini. Try again when Gemini is available, or take a screenshot.',
          )
        }
        return review(textToForm(text), { kind: 'pdf', files: [pdf] }, 'on-phone')
      }
    } catch (error) {
      setStatus('')
      setFailure({ source, message: error.message, onPhoneFailed: true })
    } finally {
      setBusy('')
      setProgress('')
    }
  }

  function sortPasted(event) {
    event.preventDefault()
    review(textToForm(pasted), { kind: 'text' }, 'pasted')
  }

  const failureBlock = (source) =>
    failure?.source === source && (
      <div role="alert" style={{ marginTop: 'var(--space-3)' }}>
        <p className="error">{failure.message}</p>
        {(source === 'images' || source === 'pdf') && !failure.onPhoneFailed && (
          <button className="btn btn-secondary" type="button" onClick={() => readOnPhone(source)} disabled={!!busy}>
            Read it on this phone instead
          </button>
        )}
      </div>
    )

  return (
    <Page title="Add a recipe">
      {!online && (
        <p className="hint">
          You're offline. Gemini and links need a connection, but this phone can still read screenshots and
          text PDFs, and you can paste or type a recipe.
        </p>
      )}

      {busy && status && (
        <Working label={status} typical={busy === 'url' ? 'a few seconds' : '5 to 15 seconds'} detail={progress} slowAfter={30} />
      )}

      <section className="card" aria-labelledby="photo-heading">
        <h2 id="photo-heading">Screenshot or photo</h2>
        <div className="field">
          <label htmlFor="photos">Choose screenshots or photos (up to 6, in order)</label>
          <input
            id="photos"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setImages([...e.target.files].slice(0, 6))}
          />
          {images.length > 0 && (
            <span className="hint">
              {images.length} {images.length === 1 ? 'image' : 'images'} selected
            </span>
          )}
        </div>
        <button
          className="btn"
          type="button"
          disabled={!images.length || !!busy}
          onClick={() => (online ? readWithGemini('images') : readOnPhone('images'))}
        >
          {busy === 'images' ? 'Reading…' : 'Read recipe'}
        </button>
        {failureBlock('images')}
      </section>

      <section className="card" aria-labelledby="pdf-heading">
        <h2 id="pdf-heading">PDF</h2>
        <div className="field">
          <label htmlFor="pdf">Choose a PDF</label>
          <input id="pdf" type="file" accept="application/pdf" onChange={(e) => setPdf(e.target.files[0] ?? null)} />
        </div>
        <button
          className="btn"
          type="button"
          disabled={!pdf || !!busy}
          onClick={() => (online ? readWithGemini('pdf') : readOnPhone('pdf'))}
        >
          {busy === 'pdf' ? 'Reading…' : 'Read recipe'}
        </button>
        {failureBlock('pdf')}
      </section>

      <section className="card" aria-labelledby="link-heading">
        <h2 id="link-heading">Link</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            readWithGemini('url')
          }}
        >
          <div className="field">
            <label htmlFor="url">Recipe web address</label>
            <input
              id="url"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <button className="btn" type="submit" disabled={!/^https?:\/\/\S+\.\S+/.test(url.trim()) || !online || !!busy}>
            {busy === 'url' ? 'Reading…' : 'Get recipe'}
          </button>
        </form>
        {failureBlock('url')}
      </section>

      <section className="card" aria-labelledby="paste-heading">
        <h2 id="paste-heading">Paste a whole recipe</h2>
        <form onSubmit={sortPasted}>
          <div className="field">
            <label htmlFor="pasted">Recipe text</label>
            <textarea
              id="pasted"
              rows={6}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              aria-describedby="pasted-hint"
            />
            <span id="pasted-hint" className="hint">
              The app sorts it into title, ingredients, and steps for you to check. Works offline.
            </span>
          </div>
          <button className="btn" type="submit" disabled={!pasted.trim()}>
            Sort it
          </button>
        </form>
      </section>

      <p>
        <Link to="/recipe/new">Or type a recipe in from scratch</Link>
      </p>
    </Page>
  )
}
