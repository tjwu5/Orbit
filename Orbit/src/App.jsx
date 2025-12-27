import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Auth from './Auth'
import TaskList from './TaskList'
import GroupLobby from './GroupLobby' // Import the new component

function App() {
  const [session, setSession] = useState(null)
  const [groupId, setGroupId] = useState(null) // NEW: Track group status
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('App.jsx - Initial session:', session?.user?.id) // Debug
      setSession(session)
      if (session) checkUserGroup(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('App.jsx - Auth state changed:', session?.user?.id) // Debug
      setSession(session)
      if (session) checkUserGroup(session.user.id)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Check if the user is already in a party
  async function checkUserGroup(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('group_id')
      .eq('id', userId)
      .single()
    
    if (data?.group_id) setGroupId(data.group_id)
    setLoading(false)
  }

  if (loading) return <h1>Loading...</h1>
  if (!session) return <Auth />

  // NEW LOGIC:
  return (
    <div className="container" style={{ padding: '50px', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1>orbit.</h1>
        <button onClick={() => supabase.auth.signOut()}>sign out</button>
      </header>
      
      {/* If they have a group, show the tasks. If not, show the lobby. */}
      {groupId ? (
        <TaskList session={session} groupId={groupId} />
      ) : (
        <GroupLobby session={session} onJoin={() => checkUserGroup(session.user.id)} />
      )}
    </div>
  )
}

export default App