import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function GroupLobby({ session, onGroupJoined }) {
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)

  const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase()

  const createGroup = async () => {
    setLoading(true)
    let attempt = 0
    let groupData = null
    let lastError = null

    while (attempt < 5 && !groupData) {
      const code = generateCode()

      const { data, error } = await supabase
        .from('groups')
        .insert([{ code }])
        .select()
        .single()

      if (error) {
        lastError = error
        attempt += 1
        continue
      }

      groupData = { ...data, code }
    }

    if (!groupData) {
      alert(lastError?.message || 'Could not create a squad. Please try again.')
      setLoading(false)
      return
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ group_id: groupData.id })
      .eq('id', session.user.id)

    if (profileError) {
      alert(profileError.message)
      setLoading(false)
      return
    }

    setLoading(false)
    onGroupJoined(groupData.code, groupData.id, true)
  }

  const joinGroup = async () => {
    if (roomCode.length < 4) return
    
    setLoading(true)
    const upperCode = roomCode.toUpperCase()
    
    const { data, error } = await supabase
      .from('groups')
      .select('id, code')
      .eq('code', upperCode)
      .single()

    if (error || !data) {
      alert('Invalid Room Code!')
      setLoading(false)
      return
    }

    console.log('Found group:', data)

    // Update user's profile with the group
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ group_id: data.id })
      .eq('id', session.user.id)

    if (profileError) {
      alert(profileError.message)
      setLoading(false)
      return
    }

    console.log('Profile updated, calling onGroupJoined with:', data.code, data.id, false)
    
    // Notify parent that group was joined (isNewGroup = false)
    // Pass the group ID as well so parent can switch to TaskList immediately
    onGroupJoined(data.code, data.id, false)
    
    setLoading(false)
  }

  return (
    <div className="card">
      <h2>👋 Welcome to Orbit!</h2>
      <p>Create a new squad or join an existing one to start tracking goals with your friends.</p>

      <div className="lobby-actions">
        <button 
          onClick={createGroup} 
          disabled={loading}
        >
          ✨ Create New Squad
        </button>
      </div>

      <hr />
      
      <p>Or join a friend's squad:</p>
      
      <div className="join-input-group">
        <input 
          type="text" 
          placeholder="CODE" 
          maxLength={4}
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          onKeyPress={(e) => e.key === 'Enter' && joinGroup()}
        />
        <button 
          onClick={joinGroup} 
          disabled={loading || roomCode.length < 4}
        >
          Join Squad
        </button>
      </div>
    </div>
  )
}