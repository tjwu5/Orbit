import { useState } from 'react'
import { supabase } from './supabaseClient'

export default function GroupLobby({ session, onJoin }) {
  const [roomCode, setRoomCode] = useState('')
  const [loading, setLoading] = useState(false)

  // OPTION A: Create a brand new group
  const createGroup = async () => {
    setLoading(true)
    // 1. Generate a random 4-character code (e.g., "XJ92")
    const code = Math.random().toString(36).substring(2, 6).toUpperCase()

    // 2. Insert into groups table
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

    // 3. Add myself to that group
    await joinGroupById(groupData.id)
  }

  // OPTION B: Join existing group
  const joinGroup = async () => {
    setLoading(true)
    // 1. Find the group ID from the code
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

    // 2. Join it
    await joinGroupById(data.id)
  }

  // Helper: Updates the user's profile with the group_id
  const joinGroupById = async (groupId) => {
    const { error } = await supabase
      .from('profiles')
      .update({ group_id: groupId })
      .eq('id', session.user.id)

    if (error) alert(error.message)
    else onJoin() // Tell the parent app we are done!
    setLoading(false)
  }

  return (
    <div className="card" style={{ textAlign: 'center', padding: '40px', border: '1px solid #ccc', borderRadius: '10px' }}>
      <h2>👋 You need a Squad!</h2>
      <p>Create a new accountability group or join an existing one.</p>

      <div style={{ margin: '30px 0' }}>
        <button onClick={createGroup} disabled={loading} style={{ padding: '15px 30px', fontSize: '18px' }}>
          ✨ Create New Party
        </button>
      </div>

      <hr />
      <p>Or join a friend:</p>
      
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <input 
          type="text" 
          placeholder="ENTER CODE" 
          maxLength={4}
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          style={{ textTransform: 'uppercase', textAlign: 'center', width: '120px', fontSize: '20px' }}
        />
        <button onClick={joinGroup} disabled={loading || roomCode.length < 4}>Join</button>
      </div>
    </div>
  )
}