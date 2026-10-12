import { useState } from 'react'
import Page from '../components/Page'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { clearPendingInvite, readPendingInvite } from '../lib/invite'

// Shown after sign-in to someone who isn't in a kitchen yet.
// With a saved invite code it joins that kitchen; otherwise it creates one.
export default function Setup() {
  const { refreshMember, signOut } = useAuth()
  const inviteCode = readPendingInvite()
  const [displayName, setDisplayName] = useState('')
  const [kitchenName, setKitchenName] = useState('Our Kitchen')
  // US for US English phones, metric elsewhere; changeable in Settings.
  const [units, setUnits] = useState(() => (/^en-US$/i.test(navigator.language || 'en-US') ? 'us' : 'metric'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const name = displayName.trim()
    const { error: rpcError } = inviteCode
      ? await supabase.rpc('join_kitchen', { invite_code: inviteCode, my_name: name })
      : await supabase.rpc('create_kitchen', { kitchen_name: kitchenName.trim(), my_name: name })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    clearPendingInvite()
    if (units !== 'us') {
      const { data: auth } = await supabase.auth.getUser()
      await supabase.from('members').update({ unit_pref: units }).eq('user_id', auth.user.id)
    }
    await refreshMember()
  }

  function cancelInvite() {
    clearPendingInvite()
    window.location.assign('/')
  }

  return (
    <Page title={inviteCode ? 'Join the kitchen' : 'Set up your kitchen'}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="display-name">Your name</label>
          <input
            id="display-name"
            autoComplete="given-name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-describedby="display-name-hint"
          />
          <span id="display-name-hint" className="hint">
            Shown on your notes and ratings.
          </span>
        </div>

        {!inviteCode && (
          <div className="field">
            <label htmlFor="kitchen-name">Kitchen name</label>
            <input
              id="kitchen-name"
              required
              value={kitchenName}
              onChange={(e) => setKitchenName(e.target.value)}
            />
          </div>
        )}

        <fieldset className="field">
          <legend>Measurements</legend>
          {[
            ['us', 'US (cups, ounces)'],
            ['metric', 'Metric (milliliters, grams)'],
          ].map(([value, label]) => (
            <label key={value} className="choice" style={{ display: 'flex' }}>
              <input type="radio" name="units" value={value} checked={units === value} onChange={() => setUnits(value)} />
              {label}
            </label>
          ))}
          <span className="hint">Every recipe shows amounts this way. You can change it in Settings.</span>
        </fieldset>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button
          className="btn"
          type="submit"
          disabled={busy || !displayName.trim() || (!inviteCode && !kitchenName.trim())}
        >
          {busy ? 'Saving…' : inviteCode ? 'Join kitchen' : 'Create kitchen'}
        </button>
      </form>

      <p style={{ marginTop: 'var(--space-6)' }}>
        {inviteCode ? (
          <button className="btn btn-secondary" type="button" onClick={cancelInvite}>
            Create my own kitchen instead
          </button>
        ) : (
          <span className="hint">
            Joining someone else's kitchen? Open the invite link they sent you.
          </span>
        )}
      </p>
      <p>
        <button className="btn btn-secondary" type="button" onClick={signOut}>
          Sign out
        </button>
      </p>
    </Page>
  )
}
