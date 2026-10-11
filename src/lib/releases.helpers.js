// Compares "0.10.1" and "0.9.2" as numbers, part by part.
export function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff) return diff
  }
  return 0
}

// Releases newer than the one someone last saw, newest first.
export function releasesSince(version, list) {
  return list.filter((r) => compareVersions(r.version, version) > 0)
}
