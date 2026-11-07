import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { DataProvider } from './lib/data'
import Layout from './components/Layout'
import Login from './pages/Login'
import Home from './pages/Home'
import Practice from './pages/Practice'
import Stats from './pages/Stats'
import Cards from './pages/Cards'
import ClassPage from './pages/ClassPage'
import Bugs from './pages/Bugs'

export default function App() {
  const { loading, session, profile } = useAuth()
  if (loading) return <Splash />
  if (!session || !profile) return <Login />
  const editor = profile.role !== 'student'
  return (
    <DataProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/cards" element={<Cards />} />
          {editor && <Route path="/class" element={<ClassPage />} />}
          {profile.role === 'superadmin' && <Route path="/bugs" element={<Bugs />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </DataProvider>
  )
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="pop text-6xl">🃏</div>
    </div>
  )
}
