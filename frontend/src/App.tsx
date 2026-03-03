import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Home } from './pages/Home'
import { TopicDetail } from './pages/TopicDetail'
import { CreateTopic } from './pages/CreateTopic'
import { Auth } from './pages/Auth'
import { useAuth } from './hooks/useAuth'

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
      <nav className='h-14 flex items-center justify-between px-5 border-b border-border bg-surface-1/80 backdrop-blur-md shrink-0'>
        <Link to='/' className='flex items-center gap-2.5 group'>
          <CruxMark size={20} />
          <span className='text-sm font-light tracking-wide text-text-primary lowercase'>
            Crux
          </span>
        </Link>
        <div className='flex items-center gap-3'>
          <span className='text-xs font-light text-text-tertiary'>
            {user?.display_name}
          </span>
          <button
            onClick={logout}
            className='text-xs font-light text-text-tertiary hover:text-text-secondary transition'
          >
            sign out
          </button>
          <div className='w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center'>
            <span className='text-[11px] font-medium text-accent'>
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
