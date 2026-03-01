import { useState } from 'react'
import { registerUser, loginUser } from '../api/client'
import { Scale } from 'lucide-react'

interface Props {
  setAuth: (token: string, user: any) => void
}

export function Auth({ setAuth }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      let data
      if (mode === 'login') {
        data = await loginUser({ email, password })
      } else {
        data = await registerUser({
          email,
          password,
          username,
          display_name: displayName,
        })
      }
      setAuth(data.access_token, data.user)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='min-h-screen flex items-center justify-center px-4 py-12 bg-surface-0'>
      <div className='w-full max-w-sm animate-slide-up'>
        <div className='text-center mb-8'>
          <Scale size={24} className='text-accent mx-auto mb-3' />
          <h1 className='text-xl font-semibold text-text-primary'>
            Welcome to Logora
          </h1>
          <p className='text-sm text-text-tertiary mt-1'>
            Structured, evidence-based debate
          </p>
        </div>

        <div className='card p-6'>
          <div className='flex gap-1 mb-6 p-1 bg-surface-2 rounded-lg'>
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === m
                    ? 'bg-surface-3 text-text-primary shadow-sm'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {m === 'login' ? 'Sign in' : 'Register'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className='space-y-4'>
            {mode === 'register' && (
              <>
                <div className='animate-slide-down'>
                  <label className='block text-xs font-medium text-text-secondary mb-1.5'>
                    Display name
                  </label>
                  <input
                    type='text'
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className='input-field'
                    required
                  />
                </div>
                <div className='animate-slide-down'>
                  <label className='block text-xs font-medium text-text-secondary mb-1.5'>
                    Username
                  </label>
                  <input
                    type='text'
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className='input-field'
                    required
                  />
                </div>
              </>
            )}
            <div>
              <label className='block text-xs font-medium text-text-secondary mb-1.5'>
                Email
              </label>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className='input-field'
                required
              />
            </div>
            <div>
              <label className='block text-xs font-medium text-text-secondary mb-1.5'>
                Password
              </label>
              <input
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className='input-field'
                required
              />
            </div>

            {error && (
              <p className='text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-slide-down'>
                {error}
              </p>
            )}

            <button
              type='submit'
              disabled={loading}
              className='w-full py-2.5 btn-primary rounded-lg text-sm'
            >
              {loading ? (
                <span className='flex items-center justify-center gap-2'>
                  <span className='w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                  Processing...
                </span>
              ) : mode === 'login' ? (
                'Sign in'
              ) : (
                'Create account'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
