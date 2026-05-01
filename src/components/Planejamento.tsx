import { useState, useMemo } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, inMonth, C_COLOR, genId } from '../lib/utils'

interface Props { curMonth: number; curYear: number }

const CATS = ['Alimentação','Moradia','Transporte','Saúde','Lazer',
  'Assinatura','Educação','Vestuário','Combustível','Outros']

export default function Planejamento({ curMonth, curYear }: Props) {
  const { db, upsertPlanGoal } = useDB()
  const [modal, setModal] = useState(false)
  const [cat, setCat] = useState(CATS[0])
  const [amount, setAmount] = useState('')

  const txs = useMemo(() => db.transactions.filter(t => inMonth(t.dateISO, curMonth, curYear)), [db.transactions, curMonth, curYear])
  const totalBudget = useMemo(() => db.planGoals.reduce((s,g) => s+g.amount, 0), [db.planGoals])
  const totalUsed = useMemo(() => txs.filter(t => t.type==='despesa').reduce((s,t) => s+t.val, 0), [txs])

  const inputStyle = { width:'100%', background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'9px', padding:'10px 12px', fontFamily:'Sora,sans-serif', fontSize:'13px', color:'var(--text)', outline:'none' }

  function save() {
    if (!amount) return
    upsertPlanGoal({ id: genId(), cat, amount: parseFloat(amount) || 0 })
    setModal(false); setAmount('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-lg font-extrabold">Planejamento Mensal</div>
          <div className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>Controle seus orçamentos por categoria</div>
        </div>
        <button onClick={() => setModal(true)} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'none', cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
          + Nova Meta
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label:'Orçamento Total', value: fmt(totalBudget), color:'var(--blue)' },
          { label:'Utilizado', value: fmt(totalUsed), color:'var(--yellow)' },
          { label:'Disponível', value: fmt(Math.max(totalBudget-totalUsed,0)), color:'var(--green)' },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4 text-center" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="text-xs uppercase tracking-wide mb-1.5" style={{ color:'var(--muted)' }}>{k.label}</div>
            <div className="font-mono text-xl font-extrabold" style={{ color:k.color }}>R$ {k.value}</div>
          </div>
        ))}
      </div>

      {/* Metas */}
      <div className="rounded-2xl p-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
        <div className="text-sm font-bold mb-4">Metas por Categoria</div>
        {db.planGoals.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {db.planGoals.map(g => {
              const used = txs.filter(t => t.type==='despesa' && t.cat===g.cat).reduce((s,t) => s+t.val, 0)
              const pct = g.amount > 0 ? Math.round(used/g.amount*100) : 0
              const color = C_COLOR[g.cat] || '#6b7591'
              const over = pct > 100
              return (
                <div key={g.id} className="rounded-xl p-3.5" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs font-semibold">{g.cat}</span>
                    <span className="text-xs font-semibold" style={{ color: over ? 'var(--red)' : 'var(--muted)' }}>{pct}%</span>
                  </div>
                  <div className="font-mono text-sm font-bold mb-2">
                    R$ {fmt(used)} <span className="text-xs font-normal" style={{ color:'var(--muted)' }}>/ R$ {fmt(g.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background:'rgba(255,255,255,.06)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: Math.min(pct,100)+'%', background: over ? 'var(--red)' : color }} />
                  </div>
                  <div className="text-xs text-right" style={{ color: over ? 'var(--red)' : 'var(--muted)' }}>
                    {over ? '⚠ Limite ultrapassado' : 'R$ ' + fmt(g.amount-used) + ' restante'}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-xs" style={{ color:'var(--muted)' }}>
            Nenhuma meta definida. Clique em "+ Nova Meta" para começar.
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,.75)', backdropFilter:'blur(8px)' }}
          onClick={e => { if(e.target===e.currentTarget) setModal(false) }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background:'var(--card2)', border:'1px solid var(--border)', animation:'mdIn .2s ease' }}>
            <div className="text-base font-bold mb-1">Nova Meta de Orçamento</div>
            <div className="text-xs mb-4" style={{ color:'var(--muted)' }}>Defina um limite de gastos por categoria</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Categoria</label>
                <select value={cat} onChange={e => setCat(e.target.value)} style={inputStyle}>
                  {CATS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Limite Mensal (R$)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" style={inputStyle} />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)} style={{ flex:1, padding:'11px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'9px', color:'var(--muted)', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>Cancelar</button>
              <button onClick={save} style={{ flex:2, padding:'11px', background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'none', borderRadius:'9px', color:'#fff', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Salvar Meta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
