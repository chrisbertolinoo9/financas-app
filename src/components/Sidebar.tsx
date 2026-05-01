import { useAuth } from '../contexts/AuthContext'
import { useDB } from '../contexts/DBContext'
import type { View } from './MainApp'

interface Props {
  view: View
  setView: (v: View) => void
}

const NAV_ITEMS: { id: View; icon: string; label: string }[] = [
  { id: 'dashboard',    icon: '⊞', label: 'Dashboard' },
  { id: 'contas',       icon: '🏦', label: 'Contas' },
  { id: 'transacoes',   icon: '⇄', label: 'Transações' },
  { id: 'cartoes',      icon: '▭', label: 'Cartões' },
  { id: 'planejamento', icon: '◎', label: 'Planejamento' },
  { id: 'relatorios',   icon: '↗', label: 'Relatórios' },
]

export default function Sidebar({ view, setView }: Props) {
  const { user, logout } = useAuth()
  const { db, clearAll } = useDB()
  const name = user?.displayName || user?.email?.split('@')[0] || 'Usuário'
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <aside className="fixed left-0 top-0 bottom-0 flex flex-col py-5 z-50 hidden md:flex" style={{ width: 232, background: 'var(--bg2)', borderRight: '1px solid var(--border)' }}>
      {/* Logo */}
      <div className="px-5 pb-5" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="text-xl font-extrabold" style={{ background: 'linear-gradient(135deg, var(--accent), var(--cyan))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>FinançasPro</div>
        <div className="text-xs mt-0.5 font-semibold tracking-widest uppercase" style={{ color: 'var(--muted)' }}>Controle Financeiro</div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <div
            key={item.id}
            onClick={() => setView(item.id)}
            className="flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-all text-sm font-medium"
            style={{
              color: view === item.id ? 'var(--accent)' : 'var(--muted)',
              background: view === item.id ? 'var(--glow)' : 'transparent',
              borderLeft: view === item.id ? '3px solid var(--accent)' : '3px solid transparent',
            }}
          >
            <span className="text-base w-5 text-center">{item.icon}</span>
            {item.label}
            {item.id === 'transacoes' && (
              <span className="ml-auto text-xs font-extrabold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--red)', color: '#fff', minWidth: 18, textAlign: 'center' }}>
                {db.transactions.length}
              </span>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3.5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 p-2.5 rounded-xl mb-2" style={{ background: 'var(--bg3)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--accent), var(--purple))' }}>{initials}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold truncate">{name}</div>
            <div className="text-xs" style={{ color: 'var(--yellow)' }}>☁️ Sincronizado</div>
          </div>
          <button onClick={logout} className="w-7 h-7 rounded-md flex items-center justify-center text-sm transition-all" style={{ background: 'rgba(239,68,68,.07)', border: '1px solid rgba(239,68,68,.13)', color: 'var(--muted)' }} title="Sair">⏻</button>
        </div>
        <button onClick={() => { if(confirm('Apagar TODOS os dados? Ação irreversível.')) clearAll() }} className="w-full py-1.5 text-xs font-semibold rounded-lg transition-all" style={{ background: 'transparent', border: '1px solid rgba(239,68,68,.15)', color: 'var(--muted)' }}>
          🗑 Limpar todos os dados
        </button>
      </div>
    </aside>
  )
}
