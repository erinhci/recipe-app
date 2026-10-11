import { useState } from 'react'
import Page from '../components/Page'
import { supabase } from '../lib/supabase'
import { readPendingInvite } from '../lib/invite'

// Sign-in with an emailed 6-digit code. A code is typed into the app,
// which matters on iPhone: an emailed link opens in Safari, which keeps
// separate storage from the home-screen app, so the session would land
// in the wrong place.
export default function SignIn() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // email | code
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const invited = Boolean(readPendingInvite())

  async function sendCode(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: sendError } = await supabase.auth.signInWithOtp({ email: email.trim() })
    setBusy(false)
    if (sendError) setError(sendError.message)
    else setStep('code')
  }

  async function verifyCode(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (verifyError) setError(verifyError.message)
    // On success, AuthProvider picks up the new session automatically.
  }

  return (
    <Page title="Sign in">
      {invited && <p>You've been invited to a shared kitchen. Sign in to join it.</p>}

      {step === 'email' ? (
        <form onSubmit={sendCode} noValidate>
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
              aria-describedby="email-hint"
            />
            <span id="email-hint" className="hint">
              We'll email you a 6-digit code. No password needed.
            </span>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn" type="submit" disabled={!email.trim() || busy}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyCode} noValidate>
          <p role="status">We sent a code to {email.trim()}.</p>
          <div className="field">
            <label htmlFor="code">6-digit code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="btn" type="submit" disabled={code.length < 6 || busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>{' '}
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => {
              setStep('email')
              setCode('')
              setError('')
            }}
          >
            Use a different email
          </button>
        </form>
      )}
    </Page>
  )
}
