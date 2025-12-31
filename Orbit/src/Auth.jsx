import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showNameConfirm, setShowNameConfirm] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (isSignUp && !showNameConfirm) {
      // Show name confirmation before actually signing up
      setShowNameConfirm(true)
      return
    }

    setLoading(true)

    if (isSignUp) {
      // Proceed with signup after name confirmation
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name }
        }
      })

      if (error) {
        alert(error.message)
        setLoading(false)
        return
      }

      if (data.user) {
        // Create or update profile with display name
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: data.user.id,
            email: data.user.email,
            display_name: name,
            current_streak: 0,
            longest_streak: 0
          })

        if (profileError) {
          console.error('Error creating profile:', profileError)
        }

        alert('Account created! Check your email for confirmation.')
        setShowNameConfirm(false)
      }
    } else {
      // Sign in
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        alert(error.message)
      }
    }
    
    setLoading(false)
  }

  const handleGoogle = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    if (error) alert(error.message)
    setLoading(false)
  }

  const handleEditName = () => {
    setShowNameConfirm(false)
  }

  // Name confirmation screen
  if (showNameConfirm) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: '450px', width: '100%' }}>
          <h2 style={{ fontSize: '2rem', marginBottom: '10px', color: '#667eea', textAlign: 'center' }}>
            Confirm Your Display Name
          </h2>
          <p style={{ marginBottom: '30px', color: '#666', textAlign: 'center' }}>
            This is how your friends will see you in Orbit
          </p>

          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '30px',
            borderRadius: '16px',
            textAlign: 'center',
            marginBottom: '30px'
          }}>
            <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '8px' }}>
              Your display name:
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '700' }}>
              {name}
            </div>
          </div>

          <div className="auth-form">
            <button 
              onClick={handleSubmit} 
              disabled={loading}
              style={{ background: '#667eea', color: 'white' }}
            >
              {loading ? 'Creating Account...' : '✓ Looks Good!'}
            </button>
            <button 
              onClick={handleEditName}
              disabled={loading}
              style={{ background: 'transparent', color: '#667eea', border: '2px solid #667eea' }}
            >
              ← Edit Name
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="card" style={{ maxWidth: '450px', width: '100%' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '10px', color: '#667eea', textAlign: 'center' }}>
          orbit.
        </h1>
        <p style={{ marginBottom: '30px', color: '#666' }}>
          The accountability app for ambitious people
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <input
              type="text"
              placeholder="Your Display Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={50}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Loading...' : isSignUp ? 'Continue →' : 'Sign In'}
          </button>
        </form>

        <p style={{ margin: '20px 0', color: '#999' }}>or</p>

        <button 
          onClick={handleGoogle} 
          disabled={loading}
          style={{ width: '100%', background: 'white', color: '#333', border: '2px solid #e0e0e0' }}
        >
          Continue with Google
        </button>

        <p style={{ marginTop: '30px', fontSize: '0.9rem' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setShowNameConfirm(false)
            }}
            disabled={loading}
            style={{ background: 'none', color: '#667eea', padding: '0', textDecoration: 'underline', boxShadow: 'none' }}
          >
            {isSignUp ? 'Sign In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  )
}