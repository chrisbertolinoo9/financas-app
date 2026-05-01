import { useMemo } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, inMonth, C_COLOR } from '../lib/utils'

interface Props { curMonth: number; curYear: number }

export default function Relatorios({ curMonth, curYear }: Props) {
  const { db } = useDB()

  const txs = useMemo(() => db.transactions.filter(t => inMonth(t.dateISO, curMonth, curYear)), [db.transactions, curMonth, curYear])
  const rec = useMemo(() => txs.filter(t => t.type==='receita').reduce((s,t) => s+t.val, 0), [txs])
  const desp = useMemo(() => txs.filter(t => t.type==='despesa').reduce((s,t) => s+t.val, 0), [txs])

  const catTotals = useMemo(() => {
    const m: Record<string,number> = {}
    txs.filter(t => t.type==='despesa').forEach(t => { m[t.cat] = (m[t.cat]||0)+t.val })
    return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,6)
  }, [txs])

  const maxV = catTotals[0]?.[1] || 1

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { icon:'📊', label:'Receitas (mês)', value: fmt(rec), color:'var(--blue)' },
          { icon:'📈', label:'Despesas (mês)', value: fmt(desp), color:'var(--red)' },
          { icon:'💰', label:'Balanço', value: (rec-desp>=0?'+ ':'- ')+'R$ '+fmt(Math.abs(rec-desp)), color: rec-desp>=0?'var(--green)':'var(--red)' },
          { icon:'🎯', label:'Metas ativas', value: String(db.planGoals.length), color:'var(--purple)' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="text-lg mb-2">{k.icon}</div>
            <div className="text-xs uppercase tracking-wide mb-1" style={{ color:'var(--muted)' }}>{k.label}</div>
            <div className="font-mono text-base font-bold" style={{ color:k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <div className="text-sm font-bold mb-4">Top Categorias (despesas)</div>
          {catTotals.length ? (
            <div className="flex flex-col gap-3">
              {catTotals.map(([cat, val]) => (
                <div key={cat}>
                  <div className="flex justify-between mb-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: C_COLOR[cat]||'#6b7591' }} />
                      {cat}
                    </div>
                    <span className="font-mono text-xs font-semibold" style={{ color:'var(--muted)' }}>R$ {fmt(val)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.06)' }}>
                    <div className="h-full rounded-full" style={{ width: Math.round(val/maxV*100)+'%', background: C_COLOR[cat]||'#6b7591' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-xs" style={{ color:'var(--muted)' }}>Sem dados</div>
          )}
        </div>

        <div className="rounded-2xl p-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <div className="text-sm font-bold mb-4">Resumo do Período</div>
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between px-3 py-2.5 rounded-lg" style={{ background:'var(--bg3)' }}>
              <span className="text-xs" style={{ color:'var(--muted)' }}>Total transações</span>
              <span className="font-mono text-xs font-bold">{txs.length}</span>
            </div>
            <div className="flex justify-between px-3 py-2.5 rounded-lg" style={{ background:'var(--bg3)' }}>
              <span className="text-xs" style={{ color:'var(--muted)' }}>Ticket médio despesas</span>
              <span className="font-mono text-xs font-bold" style={{ color:'var(--red)' }}>
                R$ {fmt(txs.filter(t=>t.type==='despesa').length ? desp/txs.filter(t=>t.type==='despesa').length : 0)}
              </span>
            </div>
            <div className="flex justify-between px-3 py-2.5 rounded-lg" style={{ background:'var(--bg3)' }}>
              <span className="text-xs" style={{ color:'var(--muted)' }}>Categorias com gasto</span>
              <span className="font-mono text-xs font-bold">{catTotals.length}</span>
            </div>
            <div className="flex justify-between px-3 py-2.5 rounded-lg" style={{ background: rec-desp>=0?'rgba(34,197,94,.07)':'rgba(239,68,68,.07)', border:'1px solid '+(rec-desp>=0?'rgba(34,197,94,.18)':'rgba(239,68,68,.18)') }}>
              <span className="text-xs font-bold">Taxa de poupança</span>
              <span className="font-mono text-xs font-bold" style={{ color: rec>0&&rec-desp>=0?'var(--green)':'var(--red)' }}>
                {rec > 0 ? Math.round((rec-desp)/rec*100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
