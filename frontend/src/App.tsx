import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Home } from './pages/Home'
import { TopicDetail } from './pages/TopicDetail'
import { CreateTopic } from './pages/CreateTopic'
import { Auth } from './pages/Auth'
import { useAuth } from './hooks/useAuth'
import { Scale } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
})

function AppShell() {
  const { token, user, loading, setAuth, logout } = useAuth()

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
      {/* Navbar */}
      <nav className='h-12 flex items-center justify-between px-5 border-b border-border bg-surface-1 shrink-0'>
        <Link to='/' className='flex items-center gap-2 group'>
          <Scale size={18} className='text-accent' />
          <span className='text-sm font-semibold text-text-primary tracking-tight'>
            Logora
          </span>
        </Link>
        <div className='flex items-center gap-3'>
          <span className='text-xs text-text-tertiary'>
            {user?.display_name}
          </span>
          <button
            onClick={logout}
            className='text-xs text-text-tertiary hover:text-text-secondary transition'
          >
            Sign out
          </button>
          <div className='w-6 h-6 rounded-full bg-accent flex items-center justify-center'>
            <span className='text-[10px] font-semibold text-white'>
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
