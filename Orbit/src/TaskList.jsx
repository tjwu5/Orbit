import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function TaskList({ session, groupId }) {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Safety check: Don't fetch if we don't have a group yet
    if (groupId) {
      fetchGroupTasks()

      // REALTIME MAGIC: Listen for changes in this specific group
      const subscription = supabase
        .channel('tasks')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'tasks', 
          filter: `group_id=eq.${groupId}` 
        }, (payload) => {
          console.log('Realtime event:', payload) // Debug log
          fetchGroupTasks() 
        })
        .subscribe()

      return () => {
        supabase.removeChannel(subscription)
      }
    }
  }, [groupId])

  // Get ALL tasks for this group (Mine + Friends)
  const fetchGroupTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        profiles ( email ) 
      `) 
      .eq('group_id', groupId)
      .order('created_at', { ascending: false }) // Show newest first
    
    if (error) {
      console.log('Error fetching tasks:', error)
    } else {
      console.log('Fetched tasks:', data) // Debug log
      setTasks(data)
    }
    setLoading(false)
  }

  const addTask = async (e) => {
    e.preventDefault()
    
    // --- 🚨 SAFETY CHECK START ---
    if (!groupId) {
      alert("Error: No Group ID found! Try refreshing the page.")
      return
    }
    // --- 🚨 SAFETY CHECK END ---

    if (!newTask.trim()) return

    // Get fresh user from Supabase auth (not from session prop)
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.log('Auth error:', userError)
      alert('Authentication error. Please refresh and try again.')
      return
    }

    console.log('Adding task with user_id:', user.id)

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ 
        title: newTask, 
        user_id: user.id, // Use fresh auth user, not session prop
        group_id: groupId,
        is_completed: false
      }])
      .select(`
        *,
        profiles ( email )
      `) // Return the inserted row with profile data
      .single()

    if (error) {
      console.log('Error adding task:', error)
      alert('Error saving task: ' + error.message)
    } else {
      console.log('Task added successfully:', data) // Debug
      // Optimistically add the task to the UI immediately
      setTasks(prevTasks => [data, ...prevTasks])
      setNewTask('')
    }
  }

  const toggleTask = async (id, isCompleted) => {
    // Optimistic update (updates UI instantly before DB finishes)
    setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !isCompleted } : t))
    
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !isCompleted })
      .eq('id', id)
    
    if (error) {
      console.log('Error toggling task:', error)
      // Revert on error
      setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: isCompleted } : t))
    }
  }

  const deleteTask = async (id) => {
    // Optimistic delete
    const originalTasks = [...tasks]
    setTasks(tasks.filter(t => t.id !== id))
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.log('Error deleting task:', error)
      // Revert on error
      setTasks(originalTasks)
    }
  }

  // Filter the list into "Me" vs "Them"
  const myTasks = tasks.filter(t => t.user_id === session.user.id)
  const friendTasks = tasks.filter(t => t.user_id !== session.user.id)

  if (loading) return <div>Loading tasks...</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
      
      {/* LEFT COLUMN: ME */}
      <div>
        <h2 style={{color: '#4285F4'}}>my goals ({myTasks.length})</h2>
        <form onSubmit={addTask} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input
            type="text"
            id="new-task-input"
            name="task"
            placeholder="add new goal..."
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            style={{ width: '100%', padding: '10px' }}
          />
          <button type="submit">Add</button>
        </form>

        {myTasks.length === 0 ? (
          <p style={{ color: '#999' }}>No goals yet. Add your first one! 🎯</p>
        ) : null}

        <ul style={{ listStyle: 'none', padding: 0 }}>
          {myTasks.map((task) => (
            <li key={task.id} className="task-card" style={{ marginBottom: '10px' }}>
              <input 
                type="checkbox" 
                checked={task.is_completed} 
                onChange={() => toggleTask(task.id, task.is_completed)}
              />
              <span style={{ textDecoration: task.is_completed ? 'line-through' : 'none' }}>
                {task.title}
              </span>
              <button onClick={() => deleteTask(task.id)} className="delete-btn">×</button>
            </li>
          ))}
        </ul>
      </div>

      {/* RIGHT COLUMN: THE SQUAD */}
      <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '10px' }}>
        <h2>squad progress ({friendTasks.length})</h2>
        {friendTasks.length === 0 ? <p>no tasks from friends yet. invite them!</p> : null}
        
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {friendTasks.map((task) => (
            <li key={task.id} style={{ marginBottom: '10px', opacity: task.is_completed ? 0.5 : 1 }}>
              <small style={{ fontWeight: 'bold', color: '#666' }}>
                {task.profiles?.email?.split('@')[0] || 'Unknown'}
              </small>
              <div style={{ 
                background: 'white', 
                padding: '10px', 
                borderRadius: '5px', 
                borderLeft: task.is_completed ? '5px solid green' : '5px solid orange',
                display: 'flex', justifyContent: 'space-between'
              }}>
                <span>{task.title}</span>
                <span>{task.is_completed ? "✅" : "⏳"}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}