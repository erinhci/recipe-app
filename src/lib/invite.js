// A pending invite code is saved while the invited person signs in,
// then used by the setup screen to join the kitchen.
const PENDING_INVITE_KEY = 'pendingInvite'

export function savePendingInvite(code) {
  try {
    localStorage.setItem(PENDING_INVITE_KEY, code)
  } catch {
    // Storage can be unavailable in private browsing; the invite step
    // then asks for the link again.
  }
}

export function readPendingInvite() {
  try {
    return localStorage.getItem(PENDING_INVITE_KEY)
  } catch {
    return null
  }
}

export function clearPendingInvite() {
  try {
    localStorage.removeItem(PENDING_INVITE_KEY)
  } catch {
    // Nothing to clear.
  }
}
