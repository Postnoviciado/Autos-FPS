import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => void
  init: () => Promise<(() => void) | undefined>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  init: async () => {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const user: User = {
          id: session.user.id,
          email: session.user.email!,
          user_metadata: session.user.user_metadata,
          created_at: session.user.created_at || new Date().toISOString(),
          updated_at: session.user.updated_at || new Date().toISOString(),
        }
        set({
          user,
          isAuthenticated: true,
        })
      }

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const user: User = {
            id: session.user.id,
            email: session.user.email!,
            user_metadata: session.user.user_metadata,
            created_at: session.user.created_at || new Date().toISOString(),
            updated_at: session.user.updated_at || new Date().toISOString(),
          }
          set({
            user,
            isAuthenticated: true,
          })
        } else {
          set({ user: null, isAuthenticated: false })
        }
      })

      return () => subscription?.unsubscribe()
    } catch (err) {
      console.error('Auth init error:', err)
      set({ user: null, isAuthenticated: false })
    }
  },

  login: async (email, password) => {
    const { data: { user, session }, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (user && session) {
      const userData: User = {
        id: user.id,
        email: user.email!,
        user_metadata: user.user_metadata,
        created_at: user.created_at || new Date().toISOString(),
        updated_at: user.updated_at || new Date().toISOString(),
      }
      set({ user: userData, isAuthenticated: true })
    }
  },

  register: async (email, password, name) => {
    const { data: { user }, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    })
    if (error) throw error

    if (user) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        if (signInError.message.toLowerCase().includes('confirm') || signInError.status === 400) {
          throw new Error('confirm_email')
        }
        throw signInError
      }

      if (signInData.user && signInData.session) {
        const userData: User = {
          id: signInData.user.id,
          email: signInData.user.email!,
          user_metadata: { name },
          created_at: signInData.user.created_at || new Date().toISOString(),
          updated_at: signInData.user.updated_at || new Date().toISOString(),
        }
        set({ user: userData, isAuthenticated: true })
      }
    }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, isAuthenticated: false })
  },
}))

