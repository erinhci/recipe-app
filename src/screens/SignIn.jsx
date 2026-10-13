import { useEffect, useRef, useState } from 'react'
import Icon from '../components/Icon'
import Scene from '../components/Scene'
import { supabase } from '../lib/supabase'
import { readPendingInvite } from '../lib/invite'

// The screens before an account: a welcome with two ways in, then
// create an account or sign in (email and password; no email is sent, so
// it works inside the home-screen app on iPhone). The main button sits at
// the bottom, in thumb reach. New sign-ups are turned off in Supabase once
// both cooks have accounts.
export default function SignIn() {
  const invited = Boolean(readPendingInvite())
  const [screen, setScreen] = useState('welcome') // welcome | signup | signin
  const headingRef = useRef(null)

  useEffect(() => {
    document.title = `${{ welcome: 'Welcome', signup: 'Create your account', signin: 'Sign in' }[screen]} · Our Kitchen`
    // Like every screen: focus starts on the heading, so a screen reader
    // says where you are.
    headingRef.current?.focus()
  }, [screen])

  if (screen === 'welcome') {
    return (
      <main id="main" className="page flow-page">
        <div className="flow-intro">
          <p className="eyebrow">Our Kitchen</p>
          <h1 ref={headingRef} tabIndex={-1}>
            Recipes you cook together
          </h1>
          <p className="flow-lede">Save recipes from anywhere, split the steps between two cooks, and keep notes on what you changed.</p>
        </div>
        <Scene cooks={[{ name: 'One cook' }, { name: 'another' }]} pose="wave" caption={false} />
        <div className="flow-foot">
          <button className="btn btn-large" type="button" onClick={() => setScreen('signup')}>
            Create an account
          </button>
          <button className="btn btn-secondary btn-large" type="button" onClick={() => setScreen('signin')}>
            Sign in
          </button>
          <p className="hint flow-note">
            {invited
              ? "You've been invited to a shared kitchen. Create an account or sign in to join it."
              : 'Got an invite from your partner? Open their link to join their kitchen.'}
          </p>
        </div>
      </main>
    )
  }

  return <AccountForm mode={screen} headingRef={headingRef} onSwitch={setScreen} onBack={() => setScreen('welcome')} />
}

function AccountForm({ mode, headingRef, onSwitch, onBack }) {
  const isSignUp = mode === 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState({ field: null, text: '' })

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError({ field: null, text: '' })
    const credentials = { email: email.trim(), password }
    const { error: authError } = isSignUp
      ? await supabase.auth.signUp(credentials)
      : await supabase.auth.signInWithPassword(credentials)
    setBusy(false)
    // Errors show under the field they're about.
    if (authError) {
      const field = /password/i.test(authError.message) && !/invalid login/i.test(authError.message) ? 'password' : 'email'
      setError({ field, text: authError.message })
    }
    // On success, AuthProvider picks up the new session automatically.
  }

  const errorFor = (field) =>
    error.field === field && (
      <span id={`${field}-error`} className="error field-error" role="alert">
        {error.text}
      </span>
    )

  return (
    <main id="main" className="page flow-page">
      <button className="back-link" type="button" onClick={onBack}>
        <span className="back-chev">
          <Icon name="chevron" size={20} />
        </span>
        Back
      </button>
      <div className="flow-intro">
        <h1 ref={headingRef} tabIndex={-1}>
          {isSignUp ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="flow-lede">{isSignUp ? 'Then a few quick questions to set up your kitchen.' : 'Sign in to your kitchen.'}</p>
      </div>
      <form onSubmit={handleSubmit} noValidate className="flow-form">
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
            aria-invalid={error.field === 'email' || undefined}
            aria-describedby={error.field === 'email' ? 'email-error' : undefined}
          />
          {errorFor('email')}
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
            aria-invalid={error.field === 'password' || undefined}
            aria-describedby={[isSignUp ? 'password-hint' : null, error.field === 'password' ? 'password-error' : null].filter(Boolean).join(' ') || undefined}
          />
          {isSignUp && (
            <span id="password-hint" className="hint">
              At least 8 characters.
            </span>
          )}
          {errorFor('password')}
          <label className="check-row">
            <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
            Show password
          </label>
        </div>
        <div className="flow-foot">
          <button className="btn btn-large" type="submit" disabled={busy || !email.trim() || password.length < (isSignUp ? 8 : 1)}>
            {busy ? 'One moment…' : isSignUp ? 'Create account' : 'Sign in'}
          </button>
          <p className="flow-switch">
            {isSignUp ? 'Have an account?' : 'New here?'}{' '}
            <button className="link-btn" type="button" onClick={() => onSwitch(isSignUp ? 'signin' : 'signup')}>
              {isSignUp ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </form>
    </main>
  )
}
