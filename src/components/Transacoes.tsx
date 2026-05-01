import { useState, useMemo } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, isoToDisplay, C_COLOR, C_ICON, todayISO, genId } from '../lib/utils'
import type { Transaction } from '../types'

interface Props { curMonth: number; curYear: number }

const CATS = ['Alimentação','Moradia','Transporte','Saúde','Lazer','Salário',
  'Freelance','Assinatura','Educação','Vestuário','Combustível','Outros']

const ACC_ICONS: Record<string,string> = { corrente:'🏦', poupanca:'🐷', investimento:'📈', carteira:'👛', outro:'💳' }

export default function Transacoes({ curMonth, curYear }: Props) {
  const { db, addTransaction, updateTransaction, deleteTransaction } = useDB()
  const [search, setSearch] = useState('')
  const [typeF, setTypeF] = useState('')
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [tab, setTab] = useState<'receita'|'despesa'|'transferencia'>('despesa')
  const [desc, setDesc] = useState('')
  const [val, setVal] = useState('')
  const [date, setDate] = useState(todayISO())
  const [cat, setCat] = useState('Outros')
  const [accId, setAccId] = useState('')
  const [cardId, setCardId] = useState('')
  const [delId, setDelId] = useState<string|null>(null)

  const allTxs = useMemo(() =>
    [...db.transactions].sort((a,b) => b.dateISO.localeCompare(a.dateISO)),
    [db.transactions]
  )

  const filtered = useMemo(() => {
    let txs = allTxs
    if (search) txs = txs.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.cat.toLowerCase().includes(search.toLowerCase()))
    if (typeF) txs = txs.filter(t => t.type === typeF)
    return txs
  }, [allTxs, search, typeF])

  function openNew() {
    setEditId(null); setTab('despesa'); setDesc(''); setVal('')
    setDate(todayISO()); setCat('Outros')
    setAccId(db.accounts[0]?.id || ''); setCardId('')
    setModal(true)
  }

  function openEdit(t: Transaction) {
    setEditId(t.id)
    setTab(t.type === 'despesa' ? 'despesa' : t.type === 'receita' ? 'receita' : 'transferencia')
    setDesc(t.name); setVal(String(t.val)); setDate(t.dateISO)
    setCat(t.cat); setAccId(t.accId || ''); setCardId(t.cardId || '')
    setModal(true)
  }

  function save() {
    if (!desc || !val || !date) return
    const v = parseFloat(val)
    if (!v) return
    const type = tab === 'transferencia' ? 'despesa' : tab
    const obj: Transaction = {
      id: editId || genId(),
      name: desc, cat, type, val: v,
      dateISO: date, date: isoToDisplay(date),
      icon: C_ICON[cat] || '💰',
      color: C_COLOR[cat] || '#6b7591',
      accId: cardId ? null : (accId || null),
      cardId: cardId || null,
    }
    if (editId) updateTransaction(obj)
    else addTransaction(obj)
    setModal(false)
  }

  const tabStyle = (t: string) => ({
    flex: 1, padding: '8px', borderRadius: '8px',
    border: '1px solid ' + (tab === t ? 'var(--accent)' : 'var(--border)'),
    background: tab === t ? 'var(--glow)' : 'transparent',
    color: tab === t ? 'var(--accent)' : 'var(--muted)',
    fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
  })

  const inputStyle = {
    width: '100%', background: 'var(--bg3)', border: '1.5px solid var(--border)',
    borderRadius: '9px', padding: '10px 12px', fontFamily: 'Sora, sans-serif',
    fontSize: '13px', color: 'var(--text)', outline: 'none'
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar..." style={{ ...inputStyle, maxWidth: 220 }} />
        <select value={typeF} onChange={e => setTypeF(e.target.value)} style={{ ...inputStyle, maxWidth: 140 }}>
          <option value="">Todos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
        </select>
        <div className="ml-auto">
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', border: 'none', cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
            ＋ Adicionar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-bold">Transações</div>
          <div className="text-xs" style={{ color: 'var(--muted)' }}>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="flex flex-col gap-0.5">
          {filtered.length ? filtered.map(t => (
            <div key={t.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg group relative"
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
              <div className="text-right flex-shrink-0 group-hover:opacity-0 transition-opacity">
                <div className="font-mono text-xs font-bold" style={{ color: t.type === 'receita' ? 'var(--green)' : 'var(--red)' }}>
                  {t.type === 'receita' ? '+' : '-'} R$ {fmt(t.val)}
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{isoToDisplay(t.dateISO)}</div>
              </div>
              {/* Ações */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden group-hover:flex gap-1"
                style={{ background: 'var(--bg3)', borderRadius: 7, padding: 3 }}>
                <button onClick={() => openEdit(t)}
                  className="w-6 h-6 rounded flex items-center justify-center text-xs transition-colors"
                  style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.08)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>✏️</button>
                <button onClick={() => setDelId(t.id)}
                  className="w-6 h-6 rounded flex items-center justify-center text-xs"
                  style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,.12)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>🗑</button>
              </div>
            </div>
          )) : (
            <div className="text-center py-10 text-xs" style={{ color: 'var(--muted)' }}>
              Nenhuma transação encontrada
            </div>
          )}
        </div>
      </div>

      {/* Modal Nova/Editar Transação */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: 'var(--card2)', border: '1px solid var(--border)', animation: 'mdIn .2s ease' }}>
            <div className="text-base font-bold mb-1">{editId ? 'Editar' : 'Nova'} Transação</div>
            <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Registre receita, despesa ou transferência</div>

            {/* Tabs */}
            <div className="flex gap-1.5 mb-4">
              {(['receita','despesa','transferencia'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)} style={tabStyle(t)}>
                  {t === 'receita' ? '↑ Receita' : t === 'despesa' ? '↓ Despesa' : '⇄ Transf.'}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--muted)' }}>Descrição</label>
                <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Mercado, Salário..." style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--muted)' }}>Valor (R$)</label>
                  <input type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="0,00" style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--muted)' }}>Data</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--muted)' }}>Categoria</label>
                  <select value={cat} onChange={e => setCat(e.target.value)} style={inputStyle}>
                    {CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color: 'var(--muted)' }}>Conta</label>
                  <select value={accId} onChange={e => setAccId(e.target.value)} style={inputStyle}>
                    <option value="">— Selecione —</option>
                    {db.accounts.map(a => <option key={a.id} value={a.id}>{ACC_ICONS[a.type]} {a.name}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: '11px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '9px', color: 'var(--muted)', fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={save} style={{ flex: 2, padding: '11px', background: tab === 'receita' ? 'linear-gradient(135deg,#22c55e,#16a34a)' : tab === 'despesa' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,var(--accent),var(--accent2))', border: 'none', borderRadius: '9px', color: '#fff', fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                Salvar {tab === 'receita' ? 'Receita' : tab === 'despesa' ? 'Despesa' : 'Transferência'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Delete */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6" style={{ background: 'var(--card2)', border: '1px solid var(--border)', animation: 'mdIn .2s ease' }}>
            <div className="text-base font-bold mb-2">⚠️ Confirmar exclusão</div>
            <div className="text-xs mb-5" style={{ color: 'var(--muted)' }}>Tem certeza? Esta ação não pode ser desfeita.</div>
            <div className="flex gap-2">
              <button onClick={() => setDelId(null)} style={{ flex: 1, padding: '10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '9px', color: 'var(--muted)', fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => { deleteTransaction(delId); setDelId(null) }} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg,#ef4444,#dc2626)', border: 'none', borderRadius: '9px', color: '#fff', fontFamily: 'Sora, sans-serif', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
