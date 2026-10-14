// Turns a drawn SVG (a share card) into a PNG and shares it with the
// phone's share sheet, or downloads it where sharing files isn't possible.
//
// The PNG is made ahead of time (prepareImage) so the tap can share right
// away: Safari only opens the share sheet straight from a tap, and drawing
// the image first could take long enough to lose it.

export async function prepareImage(svgNode, fileName) {
  if (!svgNode) return null
  const markup = new XMLSerializer().serializeToString(svgNode)
  const width = Number(svgNode.getAttribute('width'))
  const height = Number(svgNode.getAttribute('height'))
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(image, 0, 0, width, height)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    return blob ? new File([blob], fileName, { type: 'image/png' }) : null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Returns 'shared', 'downloaded', 'cancelled' or 'failed'.
export async function shareFile(file, { title, text }) {
  if (!file) return 'failed'
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text })
      return 'shared'
    } catch (error) {
      return error?.name === 'AbortError' ? 'cancelled' : 'failed'
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}
