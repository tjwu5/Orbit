import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function GroupLobby({ session, onJoin }) {
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdCode, setCreatedCode] = useState(null)

  const createGroup = async () => {
    setLoading(true)
    const code = Math.random().toString(36).substring(2, 6).toUpperCase()

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert([{ code }])
      .select()
      .single()

    if (groupError) {
      alert(groupError.message)
      setLoading(false)
      return
    }

    setCreatedCode(code)
    await joinGroupById(groupData.id)
  }

  const joinGroup = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('groups')
      .select('id')
      .eq('code', roomCode.toUpperCase())
      .single()

    if (error || !data) {
      alert('Invalid Room Code!')
      setLoading(false)
      return
    }

    await joinGroupById(data.id)
  }

  const joinGroupById = async (groupId) => {
    const { error } = await supabase
      .from('profiles')
      .update({ group_id: groupId })
      .eq('id', session.user.id)

    if (error) alert(error.message)
    else onJoin()
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
        
        {createdCode && (
          <div style={{ 
            background: '#f0f4ff', 
            padding: '15px', 
            borderRadius: '12px',
            border: '2px dashed #667eea'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#667eea' }}>
              Your Room Code:
            </p>
            <p style={{ 
              fontSize: '2rem', 
              fontWeight: '700', 
              letterSpacing: '8px',
              color: '#667eea',
              margin: 0
            }}>
              {createdCode}
            </p>
            <p style={{ margin: '8px 0 0 0', fontSize: '0.9rem', color: '#666' }}>
              Share this code with your friends!
            </p>
          </div>
        )}
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