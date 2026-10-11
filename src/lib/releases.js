// Version history, newest first. Add an entry to src/releases.json with
// every release: a version number and a few plain-language notes. The app
// shows them in Settings, in the update banner, and once after updating.
import releases from '../releases.json'
import { compareVersions, releasesSince as since } from './releases.helpers.js'

export { releases, compareVersions }
export const current = releases[0]
export const releasesSince = (version) => since(version, releases)

const dayFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
export const releaseDate = (release) => dayFormat.format(new Date(`${release.date}T12:00:00`))
