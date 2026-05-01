import type { View } from './MainApp'

interface Props { view: View; setView: (v: View) => void }

const ITEMS: { id: View; icon: string; label: string }[] = [
  { id: 'dashboard',  icon: '⊞', label: 'Dashboard' },
  { id: 'contas',     icon: '🏦', label: 'Contas' },
  { id: 'transacoes', icon: '⇄', label: 'Lançamentos' },
  { id: 'cartoes',    icon: '▭', label: 'Cartões' },
  { id: 'relatorios', icon: '↗', label: 'Mais' },
]

export default function MobileNav({ view, setView }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 flex md:hidden z-50" style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', paddingBottom: 'max(4px, env(safe-area-inset-bottom))' }}>
      {ITEMS.map(item => (
        <button key={item.id} onClick={() => setView(item.id)} className="flex-1 flex flex-col items-center gap-0.5 py-1.5 border-none text-xs font-semibold transition-colors" style={{ background: 'none', color: view === item.id ? 'var(--accent)' : 'var(--muted)', fontFamily: 'Sora, sans-serif' }}>
          <div className="w-9 h-9 flex items-center justify-center rounded-xl text-xl" style={{ background: view === item.id ? 'var(--glow)' : 'transparent' }}>{item.icon}</div>
          {item.label}
        </button>
      ))}
    </nav>
  )
}
