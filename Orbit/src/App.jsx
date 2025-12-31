import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import TaskList from './TaskList'
import GroupLobby from './GroupLobby'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [groupId, setGroupId] = useState(null)
  const [groupCode, setGroupCode] = useState(null)
  const [loading, setLoading] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [streak, setStreak] = useState({ current: 0, longest: 0 })
  const [showMenu, setShowMenu] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [copiedModal, setCopiedModal] = useState(false)

  useEffect(() => {
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
      setSession(session)
      if (session) {
        loadUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session ? 'Signed in' : 'Signed out')
      setSession(session)
      
      if (session) {
        loadUserData(session.user.id)
      } else {
        // Clear everything when signed out
        setGroupId(null)
        setGroupCode(null)
        setStreak({ current: 0, longest: 0 })
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('group_id, current_streak, longest_streak')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('Error loading user data:', error)
        setLoading(false)
        return null
      }
      
      console.log('Loaded user data:', data)
      
      // Set group_id if it exists
      if (data?.group_id) {
        setGroupId(data.group_id)
        
        // Fetch the group code separately
        const { data: groupData, error: groupError } = await supabase
          .from('groups')
          .select('code')
          .eq('id', data.group_id)
          .single()
        
        if (!groupError && groupData) {
          setGroupCode(groupData.code)
        }
      } else {
        // User has no group
        setGroupId(null)
        setGroupCode(null)
      }
      
      setStreak({
        current: data?.current_streak || 0,
        longest: data?.longest_streak || 0
      })
      
      setLoading(false)
      return data
    } catch (err) {
      console.error('Unexpected error in loadUserData:', err)
      setLoading(false)
      return null
    }
  }

  const handleGroupJoined = async (code, groupId, isNewGroup) => {
    console.log('=== handleGroupJoined called ===')
    console.log('Code:', code)
    console.log('GroupId:', groupId)
    console.log('IsNewGroup:', isNewGroup)
    
    // Set the group ID and code immediately
    setGroupId(groupId)
    setGroupCode(code)
    
    console.log('States set, should now show TaskList')
    
    // Reload user data to get streak info
    await loadUserData(session.user.id)
    
    // Show welcome modal only for newly created groups (after switching to TaskList)
    if (isNewGroup) {
      console.log('Showing welcome modal')
      setShowWelcomeModal(true)
    } else {
      console.log('Not showing modal (join, not create)')
    }
  }

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

  const leaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return
    
    const { error } = await supabase
      .from('profiles')
      .update({ group_id: null })
      .eq('id', session.user.id)
    
    if (error) {
      alert('Error leaving group: ' + error.message)
    } else {
      setGroupId(null)
      setGroupCode(null)
      setShowMenu(false)
    }
  }

  const handleSignOut = async () => {
    try {
      console.log('Signing out...')
      
      // Clear local state first
      setSession(null)
      setGroupId(null)
      setGroupCode(null)
      setShowMenu(false)
      setStreak({ current: 0, longest: 0 })
      
      // Then sign out from Supabase (don't wait for it)
      // Using { scope: 'local' } to avoid session issues
      await supabase.auth.signOut({ scope: 'local' })
      
      console.log('Successfully signed out')
    } catch (err) {
      // Ignore errors since we already cleared local state
      console.log('Sign out completed (error ignored):', err.message)
    }
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(groupCode)
      setCopiedModal(true)
      setTimeout(() => setCopiedModal(false), 2000)
    } catch (err) {
      alert(`Code: ${groupCode}`)
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
          <button onClick={() => setShowMenu(!showMenu)}>
            {showMenu ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {showMenu && (
        <div className="dropdown-menu">
          {groupId && (
            <>
              <div className="menu-item-info">
                <strong>Room Code:</strong> {groupCode}
                <button onClick={copyCode} className="copy-btn">
                  📋 Copy
                </button>
              </div>
              <button onClick={leaveGroup} className="menu-btn danger">
                ← Leave Group
              </button>
            </>
          )}
          <button onClick={handleSignOut} className="menu-btn">
            Sign Out
          </button>
        </div>
      )}

      {/* Welcome Modal for New Groups */}
      {showWelcomeModal && groupCode && (
        <div className="modal-overlay" onClick={() => setShowWelcomeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowWelcomeModal(false)}
            >
              ×
            </button>
            
            <div className="modal-header">
              <h2>🎉 Squad Created!</h2>
              <p>Share this code with your friends</p>
            </div>

            <div className="room-code-display" onClick={copyCode}>
              {groupCode}
            </div>

            <button 
              onClick={copyCode} 
              className="modal-copy-btn"
              style={copiedModal ? { background: '#48bb78' } : {}}
            >
              {copiedModal ? '✓ Copied!' : '📋 Copy Code'}
            </button>

            <p className="modal-footer">
              You can find this code anytime in the menu or members list
            </p>
          </div>
        </div>
      )}
      
      {groupId ? (
        <TaskList 
          session={session} 
          groupId={groupId}
          groupCode={groupCode}
          streak={streak}
          onStreakUpdate={() => loadUserData(session.user.id)}
        />
      ) : (
        <GroupLobby 
          session={session} 
          onGroupJoined={handleGroupJoined}
        />
      )}
    </div>
  )
}

export default App