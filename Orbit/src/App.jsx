import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import TaskList from './TaskList'
import GroupLobby from './GroupLobby'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [groupId, setGroupId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [streak, setStreak] = useState({ current: 0, longest: 0 })

  useEffect(() => {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      setDarkMode(true)
      document.body.classList.add('dark')
      document.body.classList.remove('light')
    } else {
      document.body.classList.add('light')
      document.body.classList.remove('dark')
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('App.jsx - Initial session:', session?.user?.id)
      setSession(session)
      if (session) {
        checkUserGroup(session.user.id)
        fetchUserStreak(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('App.jsx - Auth state changed:', session?.user?.id)
      setSession(session)
      if (session) {
        checkUserGroup(session.user.id)
        fetchUserStreak(session.user.id)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const toggleDarkMode = () => {
    const newMode = !darkMode
    setDarkMode(newMode)
    
    if (newMode) {
      document.body.classList.add('dark')
      document.body.classList.remove('light')
      localStorage.setItem('theme', 'dark')
    } else {
      document.body.classList.add('light')
      document.body.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }

  async function checkUserGroup(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', userId)
      .single()
    
    if (data?.group_id) setGroupId(data.group_id)
    setLoading(false)
  }

  async function fetchUserStreak(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak')
      .eq('id', userId)
      .single()
    
    if (data) {
      setStreak({
        current: data.current_streak || 0,
        longest: data.longest_streak || 0
      })
    }
  }

  if (loading) return <div className="loading">Loading...</div>
  if (!session) return <Auth />

  return (
    <div className="container">
      <header>
        <h1>orbit.</h1>
        <div className="header-actions">
          {groupId && streak.current > 0 && (
            <div className="streak-badge">
              <span className="fire">🔥</span>
              <span>{streak.current} day streak!</span>
            </div>
          )}
          <button 
            onClick={toggleDarkMode}
            className="theme-toggle"
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={() => supabase.auth.signOut()}>
            sign out
          </button>
        </div>
      </header>
      
      {groupId ? (
        <TaskList 
          session={session} 
          groupId={groupId} 
          streak={streak || { current: 0, longest: 0 }}
          onStreakUpdate={() => fetchUserStreak(session.user.id)}
        />
      ) : (
        <GroupLobby session={session} onJoin={() => checkUserGroup(session.user.id)} />
      )}
    </div>
  )
}

export default App