import { Navigate, useParams } from 'react-router-dom'
import { savePendingInvite } from '../lib/invite'

// Invite links look like /join/<code>. Save the code, then continue to
// sign-in or setup, which picks it up. Saving during render is safe here:
// it's idempotent and must happen before the redirect.
export default function Join() {
  const { code } = useParams()
  if (code) savePendingInvite(code)
  return <Navigate to="/" replace />
}
