import { useState, useMemo } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, genId } from '../lib/utils'
import type { Account } from '../types'

const ACC_ICONS: Record<string,string> = { corrente:'🏦', poupanca:'🐷', investimento:'📈', carteira:'👛', outro:'💳' }
const ACC_TYPES = [
  { val:'corrente', lbl:'Conta Corrente' }, { val:'poupanca', lbl:'Poupança' },
  { val:'investimento', lbl:'Investimento' }, { val:'carteira', lbl:'Carteira/Dinheiro' }, { val:'outro', lbl:'Outro' }
]
const COLORS = ['#6366f1','#22c55e','#06b6d4','#f59e0b','#ef4444','#8b5cf6']

export default function Contas() {
  const { db, addAccount, updateAccount, deleteAccount } = useDB()
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<Account['type']>('corrente')
  const [bal, setBal] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [delId, setDelId] = useState<string|null>(null)

  const active = useMemo(() => db.accounts.filter(a => !a.archived), [db.accounts])
  const archived = useMemo(() => db.accounts.filter(a => a.archived), [db.accounts])
  const total = useMemo(() => active.reduce((s,a) => s + a.balance, 0), [active])

  const inputStyle = { width:'100%', background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'9px', padding:'10px 12px', fontFamily:'Sora, sans-serif', fontSize:'13px', color:'var(--text)', outline:'none' }

  function openNew() {
    setEditId(null); setName(''); setType('corrente'); setBal(''); setColor(COLORS[0]); setModal(true)
  }
  function openEdit(a: Account) {
    setEditId(a.id); setName(a.name); setType(a.type)
    setBal(String(a.initialBalance || 0)); setColor(a.color || COLORS[0]); setModal(true)
  }
  function save() {
    if (!name) return
    const balance = parseFloat(bal) || 0
    const obj: Account = { id: editId || genId(), name, type, balance, initialBalance: balance, color }
    if (editId) updateAccount(obj)
    else addAccount(obj)
    setModal(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-lg font-extrabold">Minhas Contas</div>
          <div className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>Clique em uma conta para ver detalhes</div>
        </div>
        <button onClick={openNew} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'none', cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
          + Nova Conta
        </button>
      </div>

      {/* Total Bar */}
      {active.length > 0 && (
        <div className="rounded-2xl p-4 mb-4 flex items-center flex-wrap gap-3" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color:'var(--muted)' }}>Patrimônio Total</div>
            <div className="font-mono text-2xl font-extrabold" style={{ color:'var(--blue)' }}>R$ {fmt(total)}</div>
            <div className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>{active.length} conta{active.length !== 1 ? 's' : ''} ativa{active.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {active.map(a => (
              <div key={a.id} className="text-right px-3 py-1.5 rounded-lg" style={{ background:'var(--bg3)', cursor:'pointer' }}>
                <div className="text-xs" style={{ color:'var(--muted)' }}>{a.name}</div>
                <div className="font-mono text-sm font-bold" style={{ color: a.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>R$ {fmt(a.balance)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid de contas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {active.map(a => (
          <div key={a.id} className="rounded-2xl p-5 transition-all relative" style={{ background:'var(--card)', border:'1px solid var(--border)', cursor:'pointer' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.borderColor='var(--border2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.borderColor='var(--border)' }}>
            <div className="absolute top-3 right-3 flex gap-1">
              <button onClick={e => { e.stopPropagation(); openEdit(a) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--muted)', padding:'4px 6px', borderRadius:6 }}>✏️</button>
              <button onClick={e => { e.stopPropagation(); setDelId(a.id) }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--muted)', padding:'4px 6px', borderRadius:6 }}>🗑</button>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3" style={{ background: (a.color||'#6366f1') + '22' }}>
              {ACC_ICONS[a.type] || '🏦'}
            </div>
            <div className="text-sm font-bold mb-0.5">{a.name}</div>
            <div className="text-xs uppercase tracking-wide mb-3" style={{ color:'var(--muted)' }}>
              {ACC_TYPES.find(t => t.val === a.type)?.lbl || a.type}
            </div>
            <div className="font-mono text-lg font-extrabold" style={{ color: a.balance >= 0 ? 'var(--green)' : 'var(--red)' }}>
              R$ {fmt(a.balance)}
            </div>
          </div>
        ))}

        {/* Adicionar conta */}
        <div onClick={openNew} className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition-all"
          style={{ background:'var(--card)', border:'1px dashed var(--border)', cursor:'pointer', minHeight:130 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--accent)'; (e.currentTarget as HTMLElement).style.background='var(--glow)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='var(--border)'; (e.currentTarget as HTMLElement).style.background='var(--card)' }}>
          <div className="text-2xl" style={{ color:'var(--muted)' }}>＋</div>
          <div className="text-xs font-semibold" style={{ color:'var(--muted)' }}>Nova Conta</div>
        </div>
      </div>

      {/* Arquivadas */}
      {archived.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color:'var(--muted)' }}>📦 Arquivadas ({archived.length})</div>
          <div className="flex gap-2 flex-wrap">
            {archived.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg opacity-60" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
                <span className="text-xs font-semibold">{a.name}</span>
                <span className="font-mono text-xs" style={{ color:'var(--muted)' }}>R$ {fmt(a.balance)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,.75)', backdropFilter:'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background:'var(--card2)', border:'1px solid var(--border)', animation:'mdIn .2s ease' }}>
            <div className="text-base font-bold mb-1">{editId ? 'Editar' : 'Nova'} Conta</div>
            <div className="text-xs mb-4" style={{ color:'var(--muted)' }}>Adicione uma conta bancária ou carteira</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Nome</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Nubank, Itaú..." style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Tipo</label>
                  <select value={type} onChange={e => setType(e.target.value as Account['type'])} style={inputStyle}>
                    {ACC_TYPES.map(t => <option key={t.val} value={t.val}>{t.lbl}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Saldo Inicial (R$)</label>
                  <input type="number" value={bal} onChange={e => setBal(e.target.value)} placeholder="0,00" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Cor</label>
                <div className="flex gap-2">
                  {COLORS.map(c => (
                    <div key={c} onClick={() => setColor(c)} style={{ width:26, height:26, borderRadius:7, background:c, cursor:'pointer', border: color===c ? '2px solid white' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)} style={{ flex:1, padding:'11px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'9px', color:'var(--muted)', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>Cancelar</button>
              <button onClick={save} style={{ flex:2, padding:'11px', background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'none', borderRadius:'9px', color:'#fff', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Salvar Conta</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,.75)', backdropFilter:'blur(8px)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6" style={{ background:'var(--card2)', border:'1px solid var(--border)', animation:'mdIn .2s ease' }}>
            <div className="text-base font-bold mb-2">⚠️ Excluir conta?</div>
            <div className="text-xs mb-5" style={{ color:'var(--muted)' }}>Isso também removerá todas as transações vinculadas. Ação irreversível.</div>
            <div className="flex gap-2">
              <button onClick={() => setDelId(null)} style={{ flex:1, padding:'10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'9px', color:'var(--muted)', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>Cancelar</button>
              <button onClick={() => { deleteAccount(delId); setDelId(null) }} style={{ flex:1, padding:'10px', background:'linear-gradient(135deg,#ef4444,#dc2626)', border:'none', borderRadius:'9px', color:'#fff', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
