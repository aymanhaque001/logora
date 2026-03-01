import { useState, useEffect } from 'react'
import { User } from '../types'
import { getMe } from '../api/client'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('logora_token')
    if (!token) {
      setLoading(false)
      return
    }
    getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('logora_token'))
      .finally(() => setLoading(false))
  }, [])

  const token = localStorage.getItem('logora_token')

  const logout = () => {
    localStorage.removeItem('logora_token')
    setUser(null)
    window.location.href = '/'
  }

  const setAuth = (token: string, userData: User) => {
    localStorage.setItem('logora_token', token)
    setUser(userData)
  }

  return { user, token, loading, logout, setAuth }
}
