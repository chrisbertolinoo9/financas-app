import { useMemo } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, inMonth, C_COLOR, C_ICON, isoToDisplay, txBelongsToInvoice } from '../lib/utils'
import type { Transaction } from '../types'

interface Props { curMonth: number; curYear: number }

function KpiCard({ icon, label, value, sub, color, onClick }: {
  icon: string; label: string; value: string; sub: string; color: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick} className="rounded-2xl p-5 relative overflow-hidden transition-all cursor-pointer"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base mb-3" style={{ background: color + '22' }}>{icon}</div>
      <div className="text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--muted)' }}>{label}</div>
      <div className="font-mono text-lg font-bold tracking-tight" style={{ color }}>{value}</div>
      <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{sub}</div>
    </div>
  )
}

function TxRow({ t }: { t: Transaction }) {
  return (
    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors group"
      style={{ cursor: 'pointer' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
        style={{ background: (C_COLOR[t.cat] || '#6b7591') + '22' }}>
        {t.icon || C_ICON[t.cat] || '💰'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold truncate">{t.name}</div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{t.cat}</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="font-mono text-xs font-bold" style={{ color: t.type === 'receita' ? 'var(--green)' : 'var(--red)' }}>
          {t.type === 'receita' ? '+' : '-'} R$ {fmt(t.val)}
        </div>
        <div className="text-xs" style={{ color: 'var(--muted)' }}>{isoToDisplay(t.dateISO)}</div>
      </div>
    </div>
  )
}

export default function Dashboard({ curMonth, curYear }: Props) {
  const { db } = useDB()

  const txs = useMemo(() =>
    db.transactions.filter(t => inMonth(t.dateISO, curMonth, curYear)),
    [db.transactions, curMonth, curYear]
  )

  const rec  = useMemo(() => txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.val, 0), [txs])
  const desp = useMemo(() => txs.filter(t => t.type === 'despesa').reduce((s, t) => s + t.val, 0), [txs])
  const saldo = useMemo(() => db.accounts.reduce((s, a) => s + a.balance, 0), [db.accounts])
  const cartTot = useMemo(() =>
    db.cards.reduce((s, c) =>
      s + db.transactions.filter(t => t.cardId === c.id && txBelongsToInvoice(t, c, curMonth, curYear) && t.type === 'despesa').reduce((x, t) => x + t.val, 0), 0),
    [db.cards, db.transactions, curMonth, curYear]
  )

  const recent = useMemo(() =>
    [...txs].sort((a, b) => b.dateISO.localeCompare(a.dateISO)).slice(0, 8),
    [txs]
  )

  const catTotals = useMemo(() => {
    const m: Record<string, number> = {}
    txs.filter(t => t.type === 'despesa').forEach(t => { m[t.cat] = (m[t.cat] || 0) + t.val })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [txs])

  const recCatTotals = useMemo(() => {
    const m: Record<string, number> = {}
    txs.filter(t => t.type === 'receita').forEach(t => { m[t.cat] = (m[t.cat] || 0) + t.val })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [txs])

  const bal = rec - desp
  const totalDesp = catTotals.reduce((s, e) => s + e[1], 0) || 1
  const COLORS = ['#ef4444','#3b82f6','#f59e0b','#8b5cf6','#06b6d4','#22c55e']

  // Donut SVG
  const r = 38, circ = 2 * Math.PI * r
  let offset = 0
  const arcs = catTotals.slice(0, 6).map((e, i) => {
    const pct = e[1] / totalDesp
    const dash = pct * circ
    const arc = <circle key={i} cx="55" cy="55" r={r} fill="none" stroke={COLORS[i]}
      strokeWidth="14" strokeDasharray={`${dash} ${circ}`}
      strokeDashoffset={-offset} transform="rotate(-90 55 55)" />
    offset += dash
    return arc
  })

  return (
    <div>
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard icon="🏦" label="Saldo Atual" value={"R$ " + fmt(saldo)}
          sub={db.accounts.length + " conta" + (db.accounts.length !== 1 ? "s" : "")}
          color="var(--blue)" />
        <KpiCard icon="↑" label="Receitas" value={"R$ " + fmt(rec)}
          sub={txs.filter(t => t.type === 'receita').length + " lançamentos"}
          color="var(--green)" />
        <KpiCard icon="↓" label="Despesas" value={"R$ " + fmt(desp)}
          sub={txs.filter(t => t.type === 'despesa').length + " lançamentos"}
          color="var(--red)" />
        <KpiCard icon="▭" label="Cartões" value={"R$ " + fmt(cartTot)}
          sub={db.cards.length + " cartão" + (db.cards.length !== 1 ? "ões" : "")}
          color="var(--purple)" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Últimas transações */}
        <div className="md:col-span-2 rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm font-bold">Últimas Transações</div>
            <span className="text-xs font-semibold cursor-pointer" style={{ color: 'var(--accent)' }}>Ver todas →</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {recent.length
              ? recent.map(t => <TxRow key={t.id} t={t} />)
              : <div className="text-center py-8 text-xs" style={{ color: 'var(--muted)' }}>Nenhuma transação neste mês</div>
            }
          </div>
        </div>

        {/* Balanço */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-bold mb-4">Balanço do Mês</div>
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg3)' }}>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Receitas</span>
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--green)' }}>+ R$ {fmt(rec)}</span>
            </div>
            <div className="flex justify-between items-center px-3 py-2.5 rounded-lg" style={{ background: 'var(--bg3)' }}>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Despesas</span>
              <span className="font-mono text-xs font-bold" style={{ color: 'var(--red)' }}>- R$ {fmt(desp)}</span>
            </div>
            <div className="h-px" style={{ background: 'var(--border)' }} />
            <div className="flex justify-between items-center px-3 py-2.5 rounded-lg"
              style={{ background: bal >= 0 ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.07)', border: '1px solid ' + (bal >= 0 ? 'rgba(34,197,94,.18)' : 'rgba(239,68,68,.18)') }}>
              <span className="text-xs font-bold">Balanço</span>
              <span className="font-mono text-sm font-extrabold" style={{ color: bal >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {bal >= 0 ? '+ ' : '- '}R$ {fmt(Math.abs(bal))}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Despesas por categoria - Donut */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-bold mb-4">Despesas por Categoria</div>
          {catTotals.length ? (
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 110 110" width="110" height="110" style={{ flexShrink: 0 }}>
                <circle cx="55" cy="55" r={r} fill="none" stroke="rgba(255,255,255,.04)" strokeWidth="14" />
                {arcs}
                <text x="55" y="52" textAnchor="middle" fontSize="9" fontWeight="700" fill="#e8ecf4" fontFamily="Sora">Total</text>
                <text x="55" y="63" textAnchor="middle" fontSize="7" fill="#6b7591" fontFamily="JetBrains Mono">{fmt(totalDesp)}</text>
              </svg>
              <div className="flex flex-col gap-1.5 flex-1">
                {catTotals.slice(0, 6).map((e, i) => (
                  <div key={e[0]} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                    <span className="flex-1 truncate" style={{ color: 'var(--muted)' }}>{e[0]}</span>
                    <span className="font-mono font-semibold">R$ {fmt(e[1])}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--muted)' }}>Sem despesas no mês</div>
          )}
        </div>

        {/* Receitas por categoria */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-sm font-bold mb-4">Receitas por Categoria</div>
          {recCatTotals.length ? (
            <div className="flex flex-col gap-3">
              {recCatTotals.map(e => {
                const maxV = recCatTotals[0][1] || 1
                const pct = Math.round(e[1] / maxV * 100)
                return (
                  <div key={e[0]}>
                    <div className="flex justify-between mb-1">
                      <div className="flex items-center gap-1.5 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: C_COLOR[e[0]] || '#6b7591' }} />
                        {e[0]}
                      </div>
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--muted)' }}>R$ {fmt(e[1])}</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.06)' }}>
                      <div className="h-full rounded-full" style={{ width: pct + '%', background: C_COLOR[e[0]] || '#6b7591' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-xs" style={{ color: 'var(--muted)' }}>Sem receitas no mês</div>
          )}
        </div>
      </div>
    </div>
  )
}
