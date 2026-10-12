import { useEffect, useState } from 'react'
import { db } from './db.js'
import { enqueue, PHOTO_BUCKET, syncNow } from './sync.js'
import { supabase } from './supabase.js'

// Photos of finished dishes. Each cook can add one photo per meal (a
// recipe on a date); adding another replaces theirs. Photos are shrunk on
// the phone before saving, so the free 1 GB of storage holds the kitchen's
// limit of 500 many times over. The database enforces the same limits.

export const PHOTO_LIMIT = 500
export const TARGET_BYTES = 300 * 1024
export const MAX_BYTES = 500 * 1000
const LONG_EDGE = 1280

// Width and height that fit within the long edge, keeping the shape.
export function fitWithin(width, height, longEdge = LONG_EDGE) {
  const scale = Math.min(1, longEdge / Math.max(width, height))
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  }
}

// The newest photo first; within a meal, the newest added first.
export function newestFirst(photos) {
  return [...photos].sort((a, b) => b.cooked_on.localeCompare(a.cooked_on) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
}

// Where the file lives in Storage: the kitchen's folder, so only its
// cooks can read it.
export const photoPath = (kitchenId, recipeId, photoId) => `${kitchenId}/${recipeId}/${photoId}.jpg`

async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall through to an <img>, which some browsers decode more formats with.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

const toJpeg = (canvas, quality) => new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

// Shrinks a photo to a JPEG of about 300 KB at most 1280 pixels on its
// long side. Steps the quality down, then the size, until it fits.
export async function shrinkPhoto(file) {
  let image
  try {
    image = await decode(file)
  } catch {
    throw new Error("That file couldn't be opened as a photo. Try a JPEG or PNG, or take the photo from the app.")
  }
  let { width, height } = fitWithin(image.width, image.height)
  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(image, 0, 0, width, height)
    for (const quality of [0.82, 0.72, 0.62]) {
      const blob = await toJpeg(canvas, quality)
      if (blob && blob.size <= TARGET_BYTES) return { blob, width, height }
    }
    ;({ width, height } = fitWithin(width, height, Math.round(Math.max(width, height) * 0.8)))
  }
  throw new Error("That photo couldn't be made small enough. Try another one.")
}

// Adds this cook's photo of a meal, replacing their earlier one.
export async function addMealPhoto({ recipeId, cookedOn, file }, member) {
  await checkLimit(recipeId, cookedOn, member)
  const shrunk = await shrinkPhoto(file)
  return saveMealPhoto({ recipeId, cookedOn, ...shrunk }, member)
}

async function myPhotosOn(recipeId, cookedOn, member) {
  return db.meal_photos
    .where('[recipe_id+cooked_on]')
    .equals([recipeId, cookedOn])
    .filter((p) => p.added_by === member.user_id)
    .toArray()
}

async function checkLimit(recipeId, cookedOn, member) {
  const count = await db.meal_photos.count()
  const mine = await myPhotosOn(recipeId, cookedOn, member)
  if (count - mine.length >= PHOTO_LIMIT) {
    throw new Error(`Your kitchen has ${PHOTO_LIMIT} photos, the most it can keep. Remove some to add more.`)
  }
}

// Saves an already shrunk photo on this phone and queues it to send.
export async function saveMealPhoto({ recipeId, cookedOn, blob, width = null, height = null }, member) {
  await checkLimit(recipeId, cookedOn, member)
  const mine = await myPhotosOn(recipeId, cookedOn, member)
  const id = crypto.randomUUID()
  const row = {
    id,
    recipe_id: recipeId,
    cooked_on: cookedOn,
    path: photoPath(member.kitchen_id, recipeId, id),
    bytes: blob.size,
    width,
    height,
    added_by: member.user_id,
    created_at: new Date().toISOString(),
  }
  await db.transaction('rw', [db.meal_photos, db.photo_files, db.outbox], async () => {
    for (const old of mine) await removeLocally(old)
    await db.photo_files.put({ id, blob })
    await db.meal_photos.put(row)
    await enqueue('meal_photos', 'insert', row)
  })
  syncNow()
  return row
}

async function removeLocally(photo) {
  await db.meal_photos.delete(photo.id)
  await db.photo_files.delete(photo.id)
  await enqueue('meal_photos', 'delete', { id: photo.id, path: photo.path })
}

export async function removeMealPhotos(photos) {
  if (!photos.length) return
  await db.transaction('rw', [db.meal_photos, db.photo_files, db.outbox], async () => {
    for (const photo of photos) await removeLocally(photo)
  })
  syncNow()
}

// Downloads a photo this phone doesn't have yet (one at a time per photo).
const downloads = new Map()
function download(photo) {
  if (!downloads.has(photo.id)) {
    const job = (async () => {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(photo.path)
      if (error || !data) return null
      // Saved only if the photo still exists (it may have been removed).
      if (await db.meal_photos.get(photo.id)) await db.photo_files.put({ id: photo.id, blob: data })
      return data
    })().finally(() => downloads.delete(photo.id))
    downloads.set(photo.id, job)
  }
  return downloads.get(photo.id)
}

// An object URL for a photo, from this phone or downloaded once and kept.
// null while loading or when it can't be loaded (offline and not saved).
export function usePhotoUrl(photo) {
  const [url, setUrl] = useState(null)
  const id = photo?.id
  useEffect(() => {
    if (!id) return undefined
    let objectUrl = null
    let cancelled = false
    ;(async () => {
      const saved = await db.photo_files.get(id)
      const blob = saved?.blob ?? (navigator.onLine ? await download(photo) : null)
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })()
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      setUrl(null)
    }
    // The photo record doesn't change once added; its id is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  return url
}
