import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    
    // Attempt to login
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) alert(error.message)
    setLoading(false)
  }

  const handleSignUp = async (event) => {
    event.preventDefault()
    setLoading(true)

    // Attempt to sign up
    const { error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      alert(error.message)
    } else {
      alert('Check your email for the login link!')
    }
    setLoading(false)
  }

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    if (error) alert(error.message)
  }

  return (
    <div className="flex-center">
      <h3>Sign in to Sync</h3>

    <button
        onClick={handleGoogleLogin}
        style={{backgroundColor: '#4285F4', color: 'white', marginBottom: '20px'}}
    >
        Sign in with Google
    </button>

    <p>or use email</p>

      <form>
        <div>
          <input
            type="email"
            placeholder="Your Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <input
            type="password"
            placeholder="Your Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <br />
        <button onClick={handleLogin} disabled={loading}>
          {loading ? 'Loading...' : 'Log In'}
        </button>
        <button onClick={handleSignUp} disabled={loading} style={{marginLeft: '10px'}}>
          Sign Up
        </button>
      </form>
    </div>
  )
}