import { useState } from 'react'
import Page from '../components/Page'
import { supabase } from '../lib/supabase'
import { readPendingInvite } from '../lib/invite'

// Email and password sign-in. No email is sent, so it works without a
// custom email sender and stays inside the home-screen app on iPhone.
// New sign-ups are turned off in Supabase once both cooks have accounts.
export default function SignIn() {
  const invited = Boolean(readPendingInvite())
  // Someone arriving from an invite link most likely needs a new account.
  const [mode, setMode] = useState(invited ? 'signup' : 'signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isSignUp = mode === 'signup'

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const credentials = { email: email.trim(), password }
    const { error: authError } = isSignUp
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials)
    setBusy(false)
    if (authError) setError(authError.message)
    // On success, AuthProvider picks up the new session automatically.
  }

  function switchMode() {
    setMode(isSignUp ? 'signin' : 'signup')
    setError('')
  }

  return (
    <Page title={isSignUp ? 'Create your account' : 'Sign in'}>
      {invited && <p>You've been invited to a shared kitchen. Sign in or create an account to join it.</p>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={isSignUp ? 'password-hint' : undefined}
          />
          {isSignUp && (
            <span id="password-hint" className="hint">
              At least 8 characters. Your phone can save it for you.
            </span>
          )}
          <label style={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 'var(--target)' }}>
            <input
              type="checkbox"
              checked={showPassword}
              onChange={(e) => setShowPassword(e.target.checked)}
             
            />
            Show password
          </label>
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <div className="actions">
          <button
            className="btn"
            type="submit"
            disabled={busy || !email.trim() || password.length < (isSignUp ? 8 : 1)}
          >
            {busy ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
        </div>
      </form>

      <p style={{ marginTop: 'var(--space-6)' }}>
        <button className="btn btn-secondary" type="button" onClick={switchMode}>
          {isSignUp ? 'I already have an account' : 'Create an account'}
        </button>
      </p>
    </Page>
  )
}
