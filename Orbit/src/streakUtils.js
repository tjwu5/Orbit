import { supabase } from './supabaseClient'

/**
 * Calculate and update user's streak based on task completion
 * Called when a user completes all their tasks for the day
 */
export async function updateStreak(userId) {
  try {
    // Get current profile data
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak, last_completed_date')
      .eq('id', userId)
      .single()

    if (profileError) throw profileError

    const today = new Date().toISOString().split('T')[0]
    const lastCompleted = profile.last_completed_date

    let newCurrentStreak = profile.current_streak || 0
    let newLongestStreak = profile.longest_streak || 0

    if (!lastCompleted) {
      // First time completing tasks
      newCurrentStreak = 1
    } else {
      const lastDate = new Date(lastCompleted)
      const todayDate = new Date(today)
      const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24))

      if (diffDays === 0) {
        // Already completed today, no change
        return profile
      } else if (diffDays === 1) {
        // Consecutive day, increment streak
        newCurrentStreak += 1
      } else {
        // Missed days, reset streak
        newCurrentStreak = 1
      }
    }

    // Update longest streak if current is higher
    if (newCurrentStreak > newLongestStreak) {
      newLongestStreak = newCurrentStreak
    }

    // Update profile
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        current_streak: newCurrentStreak,
        longest_streak: newLongestStreak,
        last_completed_date: today
      })
      .eq('id', userId)
      .select()
      .single()

    if (updateError) throw updateError

    return updatedProfile
  } catch (error) {
    console.error('Error updating streak:', error)
    return null
  }
}

/**
 * Check if user has completed all tasks for today
 * Returns true if all tasks are completed
 */
export async function checkDailyCompletion(userId, groupId) {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Get today's tasks for this user
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, is_completed')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .eq('task_date', today)
      .eq('is_archived', false)

    if (error) throw error

    // No tasks = no completion (don't reward for doing nothing)
    if (!tasks || tasks.length === 0) {
      return false
    }

    // All tasks must be completed
    return tasks.every(task => task.is_completed)
  } catch (error) {
    console.error('Error checking daily completion:', error)
    return false
  }
}

/**
 * Check if streak should be reset due to missed day
 * Call this on app load to maintain streak accuracy
 */
export async function checkStreakValidity(userId) {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('current_streak, last_completed_date')
      .eq('id', userId)
      .single()

    if (error || !profile.last_completed_date) return

    const today = new Date()
    const lastCompleted = new Date(profile.last_completed_date)
    const diffDays = Math.floor((today - lastCompleted) / (1000 * 60 * 60 * 24))

    // If more than 1 day has passed without completion, reset streak
    if (diffDays > 1) {
      await supabase
        .from('profiles')
        .update({ current_streak: 0 })
        .eq('id', userId)

      console.log('Streak reset due to inactivity')
    }
  } catch (error) {
    console.error('Error checking streak validity:', error)
  }
}

/**
 * Get daily stats for a user
 */
export async function getDailyStats(userId, groupId) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('id, is_completed')
      .eq('user_id', userId)
      .eq('group_id', groupId)
      .eq('task_date', today)
      .eq('is_archived', false)

    if (error) throw error

    const total = tasks?.length || 0
    const completed = tasks?.filter(t => t.is_completed).length || 0
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, percentage }
  } catch (error) {
    console.error('Error getting daily stats:', error)
    return { total: 0, completed: 0, percentage: 0 }
  }
}