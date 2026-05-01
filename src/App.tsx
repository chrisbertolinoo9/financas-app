import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginScreen from './components/LoginScreen'
import MainApp from './components/MainApp'

function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">💰</div>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full" style={{
                background: 'var(--accent)',
                animation: `bp 1.2s ease infinite`,
                animationDelay: `${i * 0.2}s`
              }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return user ? <MainApp /> : <LoginScreen />
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
