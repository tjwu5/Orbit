import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function TaskList({ session, groupId, streak, onStreakUpdate }) {
  const [tasks, setTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (groupId) {
      fetchGroupTasks()

      const subscription = supabase
        .channel('tasks')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'tasks', 
          filter: `group_id=eq.${groupId}` 
        }, (payload) => {
          console.log('Realtime event:', payload)
          fetchGroupTasks()
          // Refresh streak when tasks change
          if (payload.new?.user_id === session.user.id && payload.new?.is_completed) {
            onStreakUpdate()
          }
        })
        .subscribe()

      return () => {
        supabase.removeChannel(subscription)
      }
    }
  }, [groupId])

  const fetchGroupTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        profiles ( email ) 
      `) 
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.log('Error fetching tasks:', error)
    } else {
      console.log('Fetched tasks:', data)
      setTasks(data)
    }
    setLoading(false)
  }

  const addTask = async (e) => {
    e.preventDefault()
    
    if (!groupId) {
      alert("Error: No Group ID found! Try refreshing the page.")
      return
    }

    if (!newTask.trim()) return

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
        user_id: user.id,
        group_id: groupId,
        is_completed: false
      }])
      .select(`
        *,
        profiles ( email )
      `)
      .single()

    if (error) {
      console.log('Error adding task:', error)
      alert('Error saving task: ' + error.message)
    } else {
      console.log('Task added successfully:', data)
      setTasks(prevTasks => [data, ...prevTasks])
      setNewTask('')
    }
  }

  const toggleTask = async (id, isCompleted) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !isCompleted } : t))
    
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !isCompleted })
      .eq('id', id)
    
    if (error) {
      console.log('Error toggling task:', error)
      setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: isCompleted } : t))
    } else {
      // Refresh streak after completing a task
      if (!isCompleted) {
        onStreakUpdate()
      }
    }
  }

  const deleteTask = async (id) => {
    const originalTasks = [...tasks]
    setTasks(tasks.filter(t => t.id !== id))
    
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
    
    if (error) {
      console.log('Error deleting task:', error)
      setTasks(originalTasks)
    }
  }

  const myTasks = tasks.filter(t => t.user_id === session.user.id)
  const friendTasks = tasks.filter(t => t.user_id !== session.user.id)
  
  // Calculate completion rate for today
  const todayTasks = myTasks.filter(t => {
    const taskDate = new Date(t.created_at)
    const today = new Date()
    return taskDate.toDateString() === today.toDateString()
  })
  const completedToday = todayTasks.filter(t => t.is_completed).length
  const completionRate = todayTasks.length > 0 
    ? Math.round((completedToday / todayTasks.length) * 100)
    : 0

  if (loading) return <div className="loading">Loading tasks...</div>

  return (
    <div className="tasks-grid">
      
      {/* LEFT COLUMN: MY GOALS */}
      <div className="task-column">
        <h2>
          my goals
          <span className="count">{myTasks.length}</span>
        </h2>

        {/* Streak Stats */}
        <div className="streak-stats">
          <div className="streak-stat">
            <span className="number">🔥 {streak.current}</span>
            <span className="label">Current Streak</span>
          </div>
          <div className="streak-stat">
            <span className="number">🏆 {streak.longest}</span>
            <span className="label">Best Streak</span>
          </div>
        </div>
        
        <form onSubmit={addTask} className="task-form">
          <input
            type="text"
            id="new-task-input"
            name="task"
            placeholder="what's your goal today?"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>

        {myTasks.length === 0 ? (
          <div className="empty-state">
            Add your first goal to get started!
          </div>
        ) : (
          <>
            {todayTasks.length > 0 && (
              <div style={{ 
                marginBottom: '15px', 
                padding: '12px', 
                background: completionRate === 100 ? '#d4edda' : '#fff3cd',
                borderRadius: '8px',
                textAlign: 'center',
                fontWeight: '600',
                color: completionRate === 100 ? '#155724' : '#856404'
              }}>
                Today: {completedToday}/{todayTasks.length} completed ({completionRate}%)
              </div>
            )}
            <ul className="task-list">
              {myTasks.map((task) => (
                <li key={task.id} className="task-item">
                  <input 
                    type="checkbox" 
                    checked={task.is_completed} 
                    onChange={() => toggleTask(task.id, task.is_completed)}
                  />
                  <span className={task.is_completed ? 'completed' : ''}>
                    {task.title}
                  </span>
                  <button 
                    onClick={() => deleteTask(task.id)} 
                    className="delete-btn"
                    aria-label="Delete task"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {/* RIGHT COLUMN: SQUAD PROGRESS */}
      <div className="task-column squad">
        <h2>
          squad progress
          <span className="count">{friendTasks.length}</span>
        </h2>
        
        {friendTasks.length === 0 ? (
          <div className="empty-state">
            No tasks from friends yet. Share your room code to invite them!
          </div>
        ) : (
          <div>
            {friendTasks.map((task) => (
              <div key={task.id} className="friend-task">
                <span className="friend-name">
                  {task.profiles?.email?.split('@')[0] || 'Unknown'}
                </span>
                <div className={`task-content ${task.is_completed ? 'completed' : 'pending'}`}>
                  <span>{task.title}</span>
                  <span className="task-status">
                    {task.is_completed ? "✅" : "⏳"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}