import { useEffect, useState } from 'react'

// Shows the original screenshots, PDF, or link on the review screen, so
// each parsed field can be checked against the source.
export default function OriginalPanel({ originals }) {
  const [urls, setUrls] = useState([])

  useEffect(() => {
    const files = originals?.files ?? []
    const made = files.map((file) => ({ url: URL.createObjectURL(file), isPdf: file.type === 'application/pdf' }))
    setUrls(made)
    return () => made.forEach((m) => URL.revokeObjectURL(m.url))
  }, [originals])

  if (!originals || originals.kind === 'text') return null

  return (
    <details className="card" open>
      <summary style={{ fontWeight: 600, minHeight: 'var(--target)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
        Original
      </summary>
      {originals.kind === 'url' && (
        <p>
          <a href={originals.url} target="_blank" rel="noreferrer">
            Open the original page<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
      {urls.map((item, index) =>
        item.isPdf ? (
          <p key={item.url}>
            <a href={item.url} target="_blank" rel="noreferrer">
              Open the PDF<span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        ) : (
          <img
            key={item.url}
            src={item.url}
            alt={`Original recipe, image ${index + 1} of ${urls.length}`}
            style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 'var(--space-3)', borderRadius: 'var(--radius)' }}
          />
        ),
      )}
    </details>
  )
}
