// Reading recipes on the phone, without Gemini. These libraries are large,
// so each one loads only when it's first used.

// Text from photos or screenshots, using Tesseract OCR in the browser.
// The first run downloads the English language data (a few MB), so it
// needs a connection once; after that the browser can reuse it.
export async function readImageText(images, onProgress) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: (message) => {
      if (message.status === 'recognizing text') onProgress?.(message.progress)
    },
  })
  try {
    const texts = []
    for (const image of images) {
      const { data } = await worker.recognize(image)
      texts.push(data.text)
    }
    return texts.join('\n')
  } finally {
    await worker.terminate()
  }
}

// Text from a PDF that has real text in it (most exported or downloaded
// recipe PDFs). Scanned PDFs are images and return null here.
// The library's "legacy" build carries fallbacks for newer JavaScript
// features that some iPhones and browsers don't have yet.
async function openPdf(file) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  return pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
}

export async function readPdfText(file) {
  const document = await openPdf(file)
  const pages = []
  for (let n = 1; n <= Math.min(document.numPages, 10); n++) {
    const page = await document.getPage(n)
    const content = await page.getTextContent()
    let text = ''
    for (const item of content.items) {
      text += item.str
      text += item.hasEOL ? '\n' : ' '
    }
    pages.push(text)
  }
  const all = pages.join('\n')
  return all.replace(/\s/g, '').length > 40 ? all : null
}

// The first pages of a PDF as JPEG images, for scanned PDFs too large to
// send whole. Each page is drawn about 1600 px tall.
export async function renderPdfPages(file, maxPages = 4) {
  const document = await openPdf(file)
  const blobs = []
  for (let n = 1; n <= Math.min(document.numPages, maxPages); n++) {
    const page = await document.getPage(n)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: Math.min(2, 1600 / Math.max(base.width, base.height)) })
    const canvas = window.document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const context = canvas.getContext('2d')
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    if (blob) blobs.push(blob)
  }
  return blobs
}
