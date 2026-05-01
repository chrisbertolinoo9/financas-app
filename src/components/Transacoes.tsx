import { useState, useMemo } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, isoToDisplay, C_COLOR, C_ICON, todayISO, genId, inMonth } from '../lib/utils'
import type { Transaction } from '../types'

interface Props { curMonth: number; curYear: number }

const CATS = ['Alimentação','Supermercado','Moradia','Transporte','Saúde','Lazer','Airsoft','Viagem','PC','Games',
  'Salário','Freelance','Assinatura','Educação','Vestuário','Combustível','Benefício','Rendimento','Gasto Cartão','Renda Extra','Outros']

export default function Transacoes({ curMonth, curYear }: Props) {
  const { db, addTransaction, updateTransaction, deleteTransaction, addTransfer } = useDB()
  const [customCats] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('fp_custom_import_cats') || '[]') } catch { return [] }
  })
  const allCats = [...CATS, ...customCats.filter((c: string) => !CATS.includes(c))]
  const [search, setSearch] = useState('')
  const [typeF, setTypeF] = useState('')
  const [accF, setAccF] = useState('')
  const [showAll, setShowAll] = useState(false)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [tab, setTab] = useState<'receita'|'despesa'|'transferencia'>('despesa')
  const [desc, setDesc] = useState('')
  const [val, setVal] = useState('')
  const [date, setDate] = useState(todayISO())
  const [cat, setCat] = useState('Outros')
  const [accId, setAccId] = useState('')
  const [toAccId, setToAccId] = useState('')
  const [delId, setDelId] = useState<string|null>(null)

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  const monthTxs = useMemo(() =>
    db.transactions.filter(t => inMonth(t.dateISO, curMonth, curYear)),
    [db.transactions, curMonth, curYear]
  )

  const baseTxs = useMemo(() =>
    showAll
      ? [...db.transactions].sort((a,b) => b.dateISO.localeCompare(a.dateISO))
      : [...monthTxs].sort((a,b) => b.dateISO.localeCompare(a.dateISO)),
    [db.transactions, monthTxs, showAll]
  )

  const filtered = useMemo(() => {
    let txs = baseTxs
    if (search) txs = txs.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.cat.toLowerCase().includes(search.toLowerCase()))
    if (typeF) txs = txs.filter(t => t.type === typeF)
    if (accF) txs = txs.filter(t => t.accId === accF || (t.cardId && accF === '__card__'))
    return txs
  }, [baseTxs, search, typeF, accF])

  // Totais do mes — transferencias nao entram
  const totalRec  = useMemo(() => monthTxs.filter(t => t.type === 'receita').reduce((s,t) => s+t.val, 0), [monthTxs])
  const totalDesp = useMemo(() => monthTxs.filter(t => t.type === 'despesa').reduce((s,t) => s+t.val, 0), [monthTxs])

  function openNew() {
    setEditId(null); setTab('despesa'); setDesc(''); setVal('')
    setDate(todayISO()); setCat('Outros')
    setAccId(db.accounts[0]?.id || '')
    setToAccId(db.accounts[1]?.id || '')
    setModal(true)
  }

  function openEdit(t: Transaction) {
    setEditId(t.id)
    setTab(t.type === 'despesa' ? 'despesa' : t.type === 'receita' ? 'receita' : 'transferencia')
    setDesc(t.name); setVal(String(t.val)); setDate(t.dateISO)
    setCat(t.cat); setAccId(t.accId || '')
    setToAccId(t.toAccId || '')
    setModal(true)
  }

  function save() {
    if (!desc && tab !== 'transferencia') return
    if (!val || !date) return
    const v = parseFloat(val)
    if (!v) return

    if (tab === 'transferencia') {
      if (!accId || !toAccId || accId === toAccId) return
      addTransfer(accId, toAccId, v, date, desc || 'Transferência')
      setModal(false)
      return
    }

    const obj: Transaction = {
      id: editId || genId(),
      name: desc, cat, type: tab, val: v,
      dateISO: date, date: isoToDisplay(date),
      icon: C_ICON[cat] || '💰',
      color: C_COLOR[cat] || '#6b7591',
      accId: accId || null,
      cardId: null,
      toAccId: null,
    }
    if (editId) updateTransaction(obj)
    else addTransaction(obj)
    setModal(false)
  }

  const inputStyle = {
    width: '100%', background: 'var(--bg3)', border: '1.5px solid var(--border)',
    borderRadius: '9px', padding: '10px 12px', fontFamily: 'Sora, sans-serif',
    fontSize: '13px', color: 'var(--text)', outline: 'none'
  }

  const tabBtn = (id: 'receita'|'despesa'|'transferencia', label: string, color: string) => (
    <button onClick={() => setTab(id)} style={{
      flex: 1, padding: '8px', borderRadius: '8px',
      border: '1px solid ' + (tab === id ? color : 'var(--border)'),
      background: tab === id ? color + '18' : 'transparent',
      color: tab === id ? color : 'var(--muted)',
      fontFamily: 'Sora, sans-serif', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
    }}>{label}</button>
  )

  const typeColor = (t: Transaction) => {
    if (t.type === 'receita') return 'var(--green)'
    if (t.type === 'transferencia') return 'var(--muted)'
    return 'var(--red)'
  }
  const typePrefix = (t: Transaction) => {
    if (t.type === 'receita') return '+'
    if (t.type === 'transferencia') return '⇄'
    return '-'
  }

  return (
    <div>
      {/* Resumo do mes */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Receitas</div>
          <div className="font-mono text-base font-extrabold" style={{ color: 'var(--green)' }}>R$ {fmt(totalRec)}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Despesas</div>
          <div className="font-mono text-base font-extrabold" style={{ color: 'var(--red)' }}>R$ {fmt(totalDesp)}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
          <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--muted)' }}>Balanço</div>
          <div className="font-mono text-base font-extrabold" style={{ color: totalRec - totalDesp >= 0 ? 'var(--green)' : 'var(--red)' }}>
            R$ {fmt(totalRec - totalDesp)}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 mb-5 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar..." style={{ ...inputStyle, maxWidth: 220 }} />
        <select value={typeF} onChange={e => setTypeF(e.target.value)} style={{ ...inputStyle, maxWidth: 140 }}>
          <option value="">Todos tipos</option>
          <option value="receita">Receitas</option>
          <option value="despesa">Despesas</option>
          <option value="transferencia">Transferências</option>
        </select>
        <select value={accF} onChange={e => setAccF(e.target.value)} style={{ ...inputStyle, maxWidth: 150 }}>
          <option value="">Todas contas</option>
          {db.accounts.filter(a => !a.archived).map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
          {db.cards.length > 0 && <option value="__card__">Cartões</option>}
        </select>
        <button onClick={() => setShowAll(v => !v)}
          style={{ padding:'8px 14px', borderRadius:9, border:'1px solid var(--border)', background: showAll ? 'var(--glow)' : 'transparent', color: showAll ? 'var(--accent)' : 'var(--muted)', fontFamily:'Sora,sans-serif', fontSize:12, fontWeight:600, cursor:'pointer' }}>
          {showAll ? '📅 Todos os meses' : '📅 ' + MONTHS[curMonth] + ' ' + curYear}
        </button>
        <div className="ml-auto">
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent2))', border: 'none', cursor: 'pointer', fontFamily: 'Sora, sans-serif' }}>
            ＋ Adicionar
          </button>
        </div>
      </div>

      {/* Lista */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-xs" style={{ color: 'var(--muted)' }}>
            Nenhuma transação encontrada
          </div>
        ) : filtered.map((t, i) => {
          const fromAcc = db.accounts.find(a => a.id === t.accId)
          const toAcc   = t.toAccId ? db.accounts.find(a => a.id === t.toAccId) : null
          return (
            <div key={t.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors"
              style={{ borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                style={{ background: t.type === 'transferencia' ? '#6b759118' : (C_COLOR[t.cat] || '#6b7591') + '22' }}>
                {t.type === 'transferencia' ? '⇄' : (t.icon || C_ICON[t.cat] || '💰')}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{t.name}</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  {t.type === 'transferencia'
                    ? (fromAcc ? fromAcc.name : '?') + ' → ' + (toAcc ? toAcc.name : '?')
                    : t.cat + (fromAcc ? ' · ' + fromAcc.name : '')}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-mono text-sm font-bold" style={{ color: typeColor(t) }}>
                  {typePrefix(t)} R$ {fmt(t.val)}
                </div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{isoToDisplay(t.dateISO)}</div>
              </div>
              <div className="flex gap-1 flex-shrink-0 ml-1">
                {t.type !== 'transferencia' && (
                  <button onClick={() => openEdit(t)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--muted)', padding:'4px 6px', borderRadius:6 }}>✏️</button>
                )}
                <button onClick={() => setDelId(t.id)}
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:'var(--muted)', padding:'4px 6px', borderRadius:6 }}>🗑</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,.75)', backdropFilter:'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background:'var(--card2)', border:'1px solid var(--border)', animation:'mdIn .2s ease' }}>
            <div className="text-base font-bold mb-4">{editId ? 'Editar' : 'Nova'} Transação</div>

            {/* Tabs */}
            <div className="flex gap-1.5 mb-4">
              {tabBtn('despesa',  '↓ Despesa',      'var(--red)')}
              {tabBtn('receita',  '↑ Receita',      'var(--green)')}
              {tabBtn('transferencia', '⇄ Transferência', 'var(--blue)')}
            </div>

            <div className="flex flex-col gap-3">
              {/* Valor */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Valor (R$)</label>
                <input type="number" value={val} onChange={e => setVal(e.target.value)}
                  placeholder="0,00" style={inputStyle} />
              </div>

              {/* Data */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Data</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
              </div>

              {tab === 'transferencia' ? (
                <>
                  {/* Conta origem */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>De (Origem)</label>
                    <select value={accId} onChange={e => setAccId(e.target.value)} style={inputStyle}>
                      {db.accounts.filter(a => !a.archived).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Conta destino */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Para (Destino)</label>
                    <select value={toAccId} onChange={e => setToAccId(e.target.value)} style={inputStyle}>
                      {db.accounts.filter(a => !a.archived && a.id !== accId).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  {/* Descricao opcional */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Descrição (opcional)</label>
                    <input value={desc} onChange={e => setDesc(e.target.value)}
                      placeholder="Ex: Pix para poupança" style={inputStyle} />
                  </div>
                </>
              ) : (
                <>
                  {/* Descricao */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Descrição</label>
                    <input value={desc} onChange={e => setDesc(e.target.value)}
                      placeholder="Ex: Mercado, Salário..." style={inputStyle} />
                  </div>
                  {/* Categoria */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Categoria</label>
                    <select value={cat} onChange={e => setCat(e.target.value)} style={inputStyle}>
                      {allCats.map((c: string) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  {/* Conta */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{ color:'var(--muted)' }}>Conta</label>
                    <select value={accId} onChange={e => setAccId(e.target.value)} style={inputStyle}>
                      <option value="">Sem conta</option>
                      {db.accounts.filter(a => !a.archived).map(a => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setModal(false)}
                style={{ flex:1, padding:'11px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'9px', color:'var(--muted)', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>
                Cancelar
              </button>
              <button onClick={save}
                style={{ flex:2, padding:'11px', background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'none', borderRadius:'9px', color:'#fff', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>
                {tab === 'transferencia' ? '⇄ Transferir' : editId ? 'Salvar' : 'Adicionar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,.75)', backdropFilter:'blur(8px)' }}>
          <div className="w-full max-w-xs rounded-2xl p-6" style={{ background:'var(--card2)', border:'1px solid var(--border)', animation:'mdIn .2s ease' }}>
            <div className="text-base font-bold mb-2">🗑 Excluir transação?</div>
            <div className="text-xs mb-5" style={{ color:'var(--muted)' }}>Esta ação não pode ser desfeita.</div>
            <div className="flex gap-2">
              <button onClick={() => setDelId(null)}
                style={{ flex:1, padding:'10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'9px', color:'var(--muted)', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>
                Cancelar
              </button>
              <button onClick={() => { deleteTransaction(delId); setDelId(null) }}
                style={{ flex:1, padding:'10px', background:'linear-gradient(135deg,#ef4444,#dc2626)', border:'none', borderRadius:'9px', color:'#fff', fontFamily:'Sora,sans-serif', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
