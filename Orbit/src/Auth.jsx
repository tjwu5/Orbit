import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { error } = isSignUp
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      alert(error.message)
    } else if (isSignUp) {
      alert('Check your email for the confirmation link!')
    }
    
    setLoading(false)
  }

  const handleGoogleAuth = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    if (error) alert(error.message)
    setLoading(false)
  }

  return (
    <div className="container" style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center' 
    }}>
      <div className="card" style={{ maxWidth: '450px', width: '100%' }}>
        <h1 style={{ 
          fontSize: '3rem', 
          marginBottom: '10px', 
          color: '#667eea',
          textAlign: 'center'
        }}>
          orbit.
        </h1>
        <p style={{ marginBottom: '30px', color: '#666' }}>
          the accountability app for ambitious people
        </p>

        <form onSubmit={handleEmailAuth} className="auth-form">
          <input
            type="email"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'loading...' : isSignUp ? 'sign up' : 'sign in'}
          </button>
        </form>

        <p style={{ margin: '20px 0', color: '#999' }}>or</p>

        <button 
          onClick={handleGoogleAuth} 
          disabled={loading}
          style={{ 
            width: '100%',
            background: 'white',
            color: '#333',
            border: '2px solid #e0e0e0'
          }}
        >
          continue with Google
        </button>

        <p style={{ marginTop: '30px', fontSize: '0.9rem' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsSignUp(!isSignUp)}
            disabled={loading}
            style={{
              background: 'none',
              color: '#667eea',
              padding: '0',
              textDecoration: 'underline',
              boxShadow: 'none'
            }}
          >
            {isSignUp ? 'sign in' : 'sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}