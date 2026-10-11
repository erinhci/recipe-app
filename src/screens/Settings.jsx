import { useEffect, useState } from 'react'
import Page from '../components/Page'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useOnline } from '../lib/useOnline'

export default function Settings() {
  const { member, refreshMember, signOut } = useAuth()
  const online = useOnline()
  const [cooks, setCooks] = useState([])
  const [inviteLink, setInviteLink] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!online) return
    supabase
      .from('members')
      .select('user_id, display_name')
      .then(({ data }) => setCooks(data ?? []))
  }, [online])

  async function changeUnits(event) {
    const unit_pref = event.target.value
    const { error: updateError } = await supabase
      .from('members')
      .update({ unit_pref })
      .eq('user_id', member.user_id)
    if (updateError) setError(updateError.message)
    else await refreshMember()
  }

  async function makeInvite() {
    setError('')
    setMessage('')
    const { data, error: rpcError } = await supabase.rpc('create_invite')
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    const link = `${window.location.origin}/join/${data}`
    setInviteLink(link)
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join our kitchen', url: link })
        return
      } catch {
        // Share sheet dismissed; the link stays on screen to copy.
      }
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      setMessage('Invite link copied.')
    } catch {
      setMessage('Select the link above and copy it.')
    }
  }

  const kitchenFull = cooks.length >= 2

  return (
    <Page title="Settings">
      <section className="card" aria-labelledby="you-heading">
        <h2 id="you-heading">You</h2>
        <p>{member.display_name}</p>
        <div className="field">
          <label htmlFor="units">Units</label>
          <select id="units" value={member.unit_pref} onChange={changeUnits} disabled={!online}>
            <option value="us">US (cups, tablespoons, ounces)</option>
            <option value="metric">Metric (grams, milliliters)</option>
          </select>
          {!online && <span className="hint">Connect to the internet to change this.</span>}
        </div>
      </section>

      <section className="card" aria-labelledby="kitchen-heading">
        <h2 id="kitchen-heading">Your kitchen</h2>
        {cooks.length > 0 && (
          <ul>
            {cooks.map((cook) => (
              <li key={cook.user_id}>{cook.display_name}</li>
            ))}
          </ul>
        )}
        {!kitchenFull && (
          <>
            <p>Invite the second cook with a one-time link. It works for 7 days.</p>
            <button className="btn" type="button" onClick={makeInvite} disabled={!online}>
              Create invite link
            </button>
            {inviteLink && (
              <div className="field" style={{ marginTop: 'var(--space-4)' }}>
                <label htmlFor="invite-link">Invite link</label>
                <input id="invite-link" readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
                <button className="btn btn-secondary" type="button" onClick={copyInvite}>
                  Copy link
                </button>
              </div>
            )}
          </>
        )}
        <p role="status">{message}</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </section>

      <button className="btn btn-secondary" type="button" onClick={signOut}>
        Sign out
      </button>
    </Page>
  )
}
