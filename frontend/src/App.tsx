import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Home } from './pages/Home'
import { TopicDetail } from './pages/TopicDetail'
import { CreateTopic } from './pages/CreateTopic'
import { Auth } from './pages/Auth'
import { useAuth } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'
import { Sun, Moon } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

/* Crux diamond mark — rotated square with triangular cutout */
function CruxMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox='0 0 32 32' fill='none'>
      <path
        d='M0 16.024L15.976 32 32 15.976 16.024 0 0 16.024zm15.989 7.323l-7.336-7.336 14.694-.022-7.358 7.358z'
        fill='#BF557B'
      />
    </svg>
  )
}

function AppShell() {
  const { token, user, loading, setAuth, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-surface-0'>
        <div className='w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin' />
      </div>
    )
  }

  if (!token) return <Auth setAuth={setAuth} />

  return (
    <div className='min-h-screen flex flex-col'>
      {/* Navbar — always dark regardless of theme */}
      <nav
        className='h-14 flex items-center justify-between px-5 border-b backdrop-blur-md shrink-0 sticky top-0 z-50'
        style={{
          background: 'rgba(12, 13, 15, 0.95)',
          borderBottomColor: 'rgba(191, 85, 123, 0.3)',
        }}
      >
        <Link to='/' className='flex items-center gap-2.5 group'>
          <CruxMark size={20} />
          <span className='text-sm font-light tracking-wide text-white/85 lowercase'>
            Crux
          </span>
        </Link>
        <div className='flex items-center gap-3'>
          <span className='text-xs font-light text-white/35'>
            {user?.display_name}
          </span>
          <button
            onClick={logout}
            className='text-xs font-light text-white/35 hover:text-white/65 transition'
          >
            sign out
          </button>
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className='w-7 h-7 rounded-full flex items-center justify-center text-white/45 hover:text-white/85 hover:bg-white/10 transition'
            title={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <div
            className='w-7 h-7 rounded-full flex items-center justify-center'
            style={{
              background: 'rgba(191,85,123,0.22)',
              border: '1px solid rgba(191,85,123,0.4)',
            }}
          >
            <span
              className='text-[11px] font-medium'
              style={{ color: '#d4698f' }}
            >
              {user?.display_name?.[0]?.toUpperCase()}
            </span>
          </div>
        </div>
      </nav>

      <main className='flex-1'>
        <Routes>
          <Route path='/' element={<Home />} />
          <Route path='/topics/new' element={<CreateTopic />} />
          <Route path='/topics/:id' element={<TopicDetail />} />
          <Route path='*' element={<Navigate to='/' />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
