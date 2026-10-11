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
export async function readPdfText(file) {
  const pdfjs = await import('pdfjs-dist')
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
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
