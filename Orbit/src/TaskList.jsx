import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { updateStreak, checkDailyCompletion, checkStreakValidity } from './streakUtils'

export default function TaskList({ session, groupId, groupCode, streak, onStreakUpdate }) {
  const [tasks, setTasks] = useState([])
  const [archivedTasks, setArchivedTasks] = useState([])
  const [newTask, setNewTask] = useState('')
  const [loading, setLoading] = useState(true)
  const [groupMembers, setGroupMembers] = useState([])
  const [showMembers, setShowMembers] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [reactions, setReactions] = useState({})

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (groupId) {
      // Check if streak should be reset
      checkStreakValidity(session.user.id)
      
      fetchGroupTasks()
      fetchArchivedTasks()
      fetchGroupMembers()
      fetchReactions()

      // Subscribe to task changes
      const tasksSubscription = supabase
        .channel('tasks-channel')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'tasks', 
          filter: `group_id=eq.${groupId}` 
        }, (payload) => {
          console.log('Task change:', payload)
          fetchGroupTasks()
          fetchArchivedTasks()
        })
        .subscribe()

      // Subscribe to profile changes
      const profilesSubscription = supabase
        .channel('profiles-channel')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `group_id=eq.${groupId}`
        }, (payload) => {
          console.log('Profile change:', payload)
          fetchGroupMembers()
        })
        .subscribe()

      // Subscribe to reaction changes
      const reactionsSubscription = supabase
        .channel('reactions-channel')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'reactions'
        }, () => {
          fetchReactions()
        })
        .subscribe()

      return () => {
        supabase.removeChannel(tasksSubscription)
        supabase.removeChannel(profilesSubscription)
        supabase.removeChannel(reactionsSubscription)
      }
    }
  }, [groupId])

  const fetchGroupTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        profiles ( id, email, display_name ) 
      `) 
      .eq('group_id', groupId)
      .eq('task_date', today)
      .eq('is_archived', false)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.log('Error fetching tasks:', error)
    } else {
      setTasks(data || [])
    }
    setLoading(false)
  }

  const fetchArchivedTasks = async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        profiles ( id, email, display_name )
      `)
      .eq('group_id', groupId)
      .eq('user_id', session.user.id)
      .eq('task_date', yesterdayStr)
      .order('created_at', { ascending: false })
    
    if (!error) {
      setArchivedTasks(data || [])
    }
  }

  const fetchGroupMembers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, current_streak, longest_streak')
      .eq('group_id', groupId)
      .order('display_name')
    
    if (error) {
      console.log('Error fetching members:', error)
    } else {
      setGroupMembers(data || [])
    }
  }

  const fetchReactions = async () => {
    // Only pull reactions for tasks inside this group to avoid cross-room noise
    const { data, error } = await supabase
      .from('reactions')
      .select(`
        *,
        profiles ( id, display_name ),
        tasks!inner ( id, group_id )
      `)
      .eq('tasks.group_id', groupId)

    if (error) {
      console.log('Error fetching reactions:', error)
    } else {
      const grouped = {}
      data?.forEach(reaction => {
        if (!grouped[reaction.task_id]) {
          grouped[reaction.task_id] = []
        }
        grouped[reaction.task_id].push(reaction)
      })
      setReactions(grouped)
    }
  }

  const addTask = async (e) => {
    e.preventDefault()
    
    if (!newTask.trim()) return

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ 
        title: newTask, 
        user_id: session.user.id,
        group_id: groupId,
        task_date: today,
        is_completed: false,
        is_archived: false
      }])
      .select(`
        *,
        profiles ( id, email, display_name )
      `)
      .single()

    if (error) {
      console.log('Error adding task:', error)
      alert('Error saving task: ' + error.message)
    } else {
      setTasks(prevTasks => [data, ...prevTasks])
      setNewTask('')
    }
  }

  const toggleTask = async (id, isCompleted) => {
    // Optimistic update
    setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: !isCompleted } : t))
    
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !isCompleted })
      .eq('id', id)
    
    if (error) {
      console.log('Error toggling task:', error)
      // Revert on error
      setTasks(tasks.map(t => t.id === id ? { ...t, is_completed: isCompleted } : t))
    } else {
      // Check if this completes all tasks for the day
      const allComplete = await checkDailyCompletion(session.user.id, groupId)
      
      if (allComplete && !isCompleted) {
        // User just completed their last task
        const updatedProfile = await updateStreak(session.user.id)
        if (updatedProfile) {
          onStreakUpdate()
          // Show celebration if streak is significant
          if (updatedProfile.current_streak > 1) {
            alert(`🔥 ${updatedProfile.current_streak} day streak! Keep it up!`)
          }
        }
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

  const addReaction = async (taskId, emoji) => {
    // Check if user already reacted with this emoji
    const taskReactions = reactions[taskId] || []
    const existingReaction = taskReactions.find(
      r => r.user_id === session.user.id && r.emoji === emoji
    )

    if (existingReaction) {
      // Remove reaction
      await supabase
        .from('reactions')
        .delete()
        .eq('id', existingReaction.id)
    } else {
      // Add reaction
      await supabase
        .from('reactions')
        .insert({
          task_id: taskId,
          user_id: session.user.id,
          emoji: emoji
        })
    }

    fetchReactions()
  }

  const copyInviteCode = () => {
    navigator.clipboard.writeText(groupCode)
    alert(`Room code ${groupCode} copied!`)
  }

  const getUserDisplay = (profile) => {
    if (!profile) return 'Unknown User'
    return profile.display_name || profile.email?.split('@')[0] || 'Unknown User'
  }

  const getReactionCount = (taskId, emoji) => {
    const taskReactions = reactions[taskId] || []
    return taskReactions.filter(r => r.emoji === emoji).length
  }

  const hasUserReacted = (taskId, emoji) => {
    const taskReactions = reactions[taskId] || []
    return taskReactions.some(r => r.user_id === session.user.id && r.emoji === emoji)
  }

  const myTasks = tasks.filter(t => t.user_id === session.user.id)
  const friendTasks = tasks.filter(t => t.user_id !== session.user.id)
  
  const completedToday = myTasks.filter(t => t.is_completed).length
  const totalToday = myTasks.length
  const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0

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
            placeholder="what's your goal today?"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
          />
          <button type="submit">Add</button>
        </form>

        {/* Today's Progress */}
        {totalToday > 0 && (
          <div style={{ 
            marginBottom: '15px', 
            padding: '12px', 
            background: completionRate === 100 ? '#d4edda' : '#fff3cd',
            borderRadius: '8px',
            textAlign: 'center',
            fontWeight: '600',
            color: completionRate === 100 ? '#155724' : '#856404'
          }}>
            {completionRate === 100 ? '🎉 All done today!' : `Today: ${completedToday}/${totalToday} (${completionRate}%)`}
          </div>
        )}

        {myTasks.length === 0 ? (
          <div className="empty-state">
            Add your first goal to get started!
          </div>
        ) : (
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
        )}

        {/* Yesterday's Progress */}
        {archivedTasks.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <button
              onClick={() => setShowArchived(!showArchived)}
              style={{
                width: '100%',
                background: 'rgba(102, 126, 234, 0.1)',
                color: '#667eea',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                padding: '10px',
                marginBottom: showArchived ? '10px' : '0'
              }}
            >
              {showArchived ? '▼' : '▶'} Yesterday's Progress ({archivedTasks.length} tasks)
            </button>
            {showArchived && (
              <ul className="task-list" style={{ opacity: 0.7 }}>
                {archivedTasks.map((task) => (
                  <li key={task.id} className="task-item">
                    <input type="checkbox" checked={task.is_completed} disabled />
                    <span className={task.is_completed ? 'completed' : ''}>
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: SQUAD PROGRESS */}
      <div className="task-column squad">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>
            squad progress
            <span className="count">{friendTasks.length}</span>
          </h2>
          <button 
            onClick={() => setShowMembers(!showMembers)}
            style={{ 
              padding: '8px 16px',
              fontSize: '0.9rem',
              background: showMembers ? '#667eea' : 'white',
              color: showMembers ? 'white' : '#667eea'
            }}
          >
            {showMembers ? 'Hide' : 'Show'} Members ({groupMembers.length})
          </button>
        </div>

        {/* Group Members Panel */}
        {showMembers && (
          <div className="members-panel">
            <div className="invite-section">
              <p style={{ margin: '0 0 10px 0', fontWeight: '600' }}>
                Invite friends with code:
              </p>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <code style={{ 
                  background: 'rgba(102, 126, 234, 0.1)',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '1.2rem',
                  fontWeight: '700',
                  letterSpacing: '3px',
                  flex: 1,
                  textAlign: 'center'
                }}>
                  {groupCode}
                </code>
                <button onClick={copyInviteCode} style={{ whiteSpace: 'nowrap' }}>
                  📋 Copy
                </button>
              </div>
            </div>

            <div className="members-list">
              <h3 style={{ margin: '20px 0 10px 0', fontSize: '1rem' }}>
                Members:
              </h3>
              {groupMembers.map(member => (
                <div key={member.id} className="member-item">
                  <div>
                    <strong>{getUserDisplay(member)}</strong>
                    {member.id === session.user.id && <span style={{ opacity: 0.6 }}> (you)</span>}
                  </div>
                  <div style={{ fontSize: '0.9rem' }}>
                    {member.current_streak > 0 ? (
                      <>🔥 {member.current_streak} day streak</>
                    ) : (
                      <span style={{ opacity: 0.5 }}>No streak yet</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Squad Tasks */}
        {friendTasks.length === 0 ? (
          <div className="empty-state">
            No tasks from friends yet. Invite them with your room code!
          </div>
        ) : (
          <div>
            {friendTasks.map((task) => (
              <div key={task.id} className="friend-task">
                <span className="friend-name">
                  {getUserDisplay(task.profiles)}
                </span>
                <div className={`task-content ${task.is_completed ? 'completed' : 'pending'}`}>
                  <span>{task.title}</span>
                  <span className="task-status">
                    {task.is_completed ? "✅" : "⏳"}
                  </span>
                </div>
                
                {/* Reactions */}
                {task.is_completed && (
                  <div className="reactions-container">
                    {['🔥', '👏', '💪', '🎉', '❤️'].map(emoji => {
                      const count = getReactionCount(task.id, emoji)
                      const reacted = hasUserReacted(task.id, emoji)
                      
                      return (
                        <button
                          key={emoji}
                          className={`reaction-btn ${reacted ? 'reacted' : ''}`}
                          onClick={() => addReaction(task.id, emoji)}
                          title={`React with ${emoji}`}
                        >
                          {emoji} {count > 0 && <span className="reaction-count">{count}</span>}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}