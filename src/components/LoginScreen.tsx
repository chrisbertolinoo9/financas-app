import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginScreen() {
  const { signIn, signInGoogle, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const errMap: Record<string, string> = {
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/email-already-in-use': 'E-mail já cadastrado. Faça login.',
    'auth/weak-password': 'Senha muito fraca (mín. 6 caracteres).',
  }

  const handleLogin = async () => {
    if (!email || !password) { setError('Preencha e-mail e senha.'); return }
    setLoading(true); setError('')
    try {
      await signIn(email, password)
    } catch (e: any) {
      setError(errMap[e.code] || 'Erro ao entrar: ' + e.message)
    } finally { setLoading(false) }
  }

  const handleRegister = async () => {
    if (!email || !password) { setError('Preencha e-mail e senha.'); return }
    if (password.length < 6) { setError('Senha deve ter pelo menos 6 caracteres.'); return }
    setLoading(true); setError('')
    try {
      await signUp(email, password)
    } catch (e: any) {
      setError(errMap[e.code] || 'Erro ao criar conta.')
    } finally { setLoading(false) }
  }

  const handleGoogle = async () => {
    setLoading(true); setError('')
    try {
      await signInGoogle()
    } catch (e: any) {
      const codes: Record<string, string> = {
        'auth/popup-closed-by-user': 'Login cancelado.',
        'auth/popup-blocked': 'Popup bloqueado. Permita popups para este site.',
      }
      setError(codes[e.code] || 'Erro ao entrar com Google.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute rounded-full opacity-20" style={{ width: 500, height: 500, background: 'radial-gradient(circle, #6366f1, transparent)', top: -150, left: -100, filter: 'blur(90px)' }} />
        <div className="absolute rounded-full opacity-20" style={{ width: 400, height: 400, background: 'radial-gradient(circle, #06b6d4, transparent)', bottom: -100, right: -80, filter: 'blur(90px)' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm" style={{ animation: 'liIn .5s cubic-bezier(.16,1,.3,1)' }}>
        <div className="rounded-2xl p-10 backdrop-blur-xl" style={{ background: 'rgba(20,25,41,0.9)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 32px 80px rgba(0,0,0,.6)' }}>

          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3" style={{ background: 'linear-gradient(135deg, var(--accent), var(--cyan))', boxShadow: '0 8px 28px rgba(99,102,241,.4)' }}>💰</div>
            <div className="text-xl font-extrabold" style={{ background: 'linear-gradient(135deg, var(--accent), var(--cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FinançasPro</div>
            <div className="text-xs mt-1 tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Controle Financeiro Pessoal</div>
          </div>

          <div className="text-base font-bold mb-1">Bem-vindo de volta 👋</div>
          <div className="text-xs mb-6" style={{ color: 'var(--muted)' }}>Entre com suas credenciais para continuar</div>

          {/* Campos */}
          <div className="mb-3">
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted)' }}>E-mail</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">✉️</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="seu@email.com"
                className="w-full rounded-xl py-3 pl-10 pr-4 text-sm outline-none transition-all"
                style={{ background: 'var(--bg3)', border: '1.5px solid var(--border)', color: 'var(--text)', fontFamily: 'Sora, sans-serif' }}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-xs font-bold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--muted)' }}>Senha</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm pointer-events-none">🔑</span>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="w-full rounded-xl py-3 pl-10 pr-12 text-sm outline-none transition-all"
                style={{ background: 'var(--bg3)', border: '1.5px solid var(--border)', color: 'var(--text)', fontFamily: 'Sora, sans-serif' }}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-base" style={{ color: 'var(--muted)', background: 'none', border: 'none' }}>
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold mb-4" style={{ background: 'rgba(239,68,68,.09)', border: '1px solid rgba(239,68,68,.22)', color: 'var(--red)', animation: 'shake .4s ease' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Botão entrar */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold text-white mb-3 transition-all"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', boxShadow: '0 4px 18px rgba(99,102,241,.35)', opacity: loading ? 0.8 : 1 }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-1">
                {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-white" style={{ animation: `bp 1.2s ease infinite`, animationDelay: `${i*0.2}s` }} />)}
              </span>
            ) : 'Entrar →'}
          </button>

          {/* Divisor */}
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>OU</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all mb-3"
            style={{ background: 'var(--bg3)', border: '1.5px solid var(--border)', color: 'var(--text)' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-7.9 19.7-20 0-1.3-.1-2.7-.1-4z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.1 18.9 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5L31.8 34c-2.1 1.5-4.8 2.4-7.8 2.4-5.2 0-9.6-3.5-11.1-8.3l-6.5 5C9.8 40 16.4 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.5-2.4 4.6-4.5 6l5.7 5c3.4-3.1 5.5-7.7 5.5-13-.1-1.3-.2-2.7-.4-6z"/>
            </svg>
            Entrar com Google
          </button>

          {/* Criar conta */}
          <div className="text-center text-xs mt-2" style={{ color: 'var(--muted)' }}>
            Não tem conta?{' '}
            <span onClick={handleRegister} className="cursor-pointer font-bold" style={{ color: 'var(--accent)' }}>
              Criar conta grátis
            </span>
          </div>
          <div className="text-center text-xs mt-2 opacity-60" style={{ color: 'var(--muted)' }}>☁️ Dados sincronizados na nuvem</div>
        </div>
      </div>
    </div>
  )
}
