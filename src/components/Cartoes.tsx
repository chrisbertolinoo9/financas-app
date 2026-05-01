import { useState, useMemo } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, txBelongsToInvoice, isoToDisplay, C_COLOR, C_ICON, genId, todayISO } from '../lib/utils'
import type { Card, Transaction } from '../types'
import ImportModal from './ImportModal'

interface Props { curMonth: number; curYear: number }

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const BRANDS = ['Visa','Mastercard','Elo','Amex','Hipercard','Outro']
const CARD_COLORS = ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#22c55e','#f59e0b','#ef4444']
const CATS = ['Alimentação','Moradia','Transporte','Saúde','Lazer','Salário','Freelance','Assinatura','Educação','Vestuário','Combustível','Outros']

export default function Cartoes({ curMonth, curYear }: Props) {
  const { db, addCard, updateCard, deleteCard, addTransaction, updateTransaction, deleteTransaction } = useDB()
  const [cardModal, setCardModal] = useState(false)
  const [editCardId, setEditCardId] = useState<string|null>(null)
  const [cName, setCName] = useState('')
  const [cBrand, setCBrand] = useState('Visa')
  const [cType, setCType] = useState<Card['type']>('credito')
  const [cLimit, setCLimit] = useState('')
  const [cDue, setCDue] = useState('')
  const [cColor, setCColor] = useState(CARD_COLORS[0])
  const [delCardId, setDelCardId] = useState<string|null>(null)
  const [invoiceCard, setInvoiceCard] = useState<Card|null>(null)
  const [txModal, setTxModal] = useState(false)
  const [txDesc, setTxDesc] = useState('')
  const [txVal, setTxVal] = useState('')
  const [txDate, setTxDate] = useState(todayISO())
  const [txCat, setTxCat] = useState('Outros')
  const [delTxId, setDelTxId] = useState<string|null>(null)
  const [editTxId, setEditTxId] = useState<string|null>(null)
  const [editCat, setEditCat] = useState('')
  const [editName, setEditName] = useState('')
  const [customCats] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('fp_custom_import_cats') || '[]') } catch { return [] }
  })
  const [importCardId, setImportCardId] = useState<string|null>(null)
  const [importMonth, setImportMonth] = useState(curMonth)
  const [importYear, setImportYear] = useState(curYear)
  const [showImportPicker, setShowImportPicker] = useState(false)

  function cardSpend(cardId: string) {
    const card = db.cards.find(c => c.id === cardId)
    if (!card) return 0
    return db.transactions.filter(t => t.cardId === cardId && txBelongsToInvoice(t, card, curMonth, curYear) && t.type === 'despesa').reduce((s,t) => s+t.val, 0)
  }

  const totalFaturas = useMemo(() => db.cards.reduce((s,c) => s+cardSpend(c.id), 0), [db.cards, db.transactions, curMonth, curYear])
  const totalLimit = useMemo(() => db.cards.reduce((s,c) => s+c.limit, 0), [db.cards])

  const inputStyle = { width:'100%', background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'9px', padding:'10px 12px', fontFamily:'Sora,sans-serif', fontSize:'13px', color:'var(--text)', outline:'none' }

  function openNewCard() {
    setEditCardId(null); setCName(''); setCBrand('Visa'); setCType('credito')
    setCLimit(''); setCDue(''); setCColor(CARD_COLORS[0]); setCardModal(true)
  }
  function openEditCard(c: Card) {
    setEditCardId(c.id); setCName(c.name); setCBrand(c.brand); setCType(c.type)
    setCLimit(String(c.limit)); setCDue(String(c.due)); setCColor(c.color||CARD_COLORS[0]); setCardModal(true)
  }
  function saveCard() {
    if (!cName) return
    const obj: Card = { id: editCardId||genId(), name:cName, brand:cBrand, type:cType, limit:parseFloat(cLimit)||0, balance:parseFloat(cLimit)||0, due:parseInt(cDue)||1, color:cColor }
    if (editCardId) updateCard(obj)
    else addCard(obj)
    setCardModal(false)
  }

  function saveTx() {
    if (!txDesc||!txVal||!invoiceCard) return
    const v = parseFloat(txVal)
    if (!v) return
    const t: Transaction = {
      id: genId(), name:txDesc, cat:txCat, type:'despesa', val:v,
      dateISO:txDate, date:isoToDisplay(txDate),
      icon:C_ICON[txCat]||'💰', color:C_COLOR[txCat]||'#6b7591',
      accId:null, cardId:invoiceCard.id,
      invoiceMonth:curMonth, invoiceYear:curYear
    }
    addTransaction(t)
    setTxModal(false); setTxDesc(''); setTxVal('')
  }

  const dueMonth = (curMonth+1)>11?0:curMonth+1
  const dueYear = (curMonth+1)>11?curYear+1:curYear

  const invTxs = useMemo(() => {
    if (!invoiceCard) return []
    return db.transactions.filter(t => t.cardId===invoiceCard.id && txBelongsToInvoice(t, invoiceCard, curMonth, curYear)).sort((a,b)=>b.dateISO.localeCompare(a.dateISO))
  }, [invoiceCard, db.transactions, curMonth, curYear])

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-lg font-extrabold">Cartões de Crédito</div>
          <div className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>Clique em um cartão para ver a fatura</div>
        </div>
        <button onClick={openNewCard} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'none', cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
          + Novo Cartão
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lista de cartões */}
        <div className="rounded-2xl p-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <div className="text-sm font-bold mb-4">Meus Cartões</div>
          <div className="flex flex-col gap-2.5">
            {db.cards.length ? db.cards.map(c => {
              const spent = cardSpend(c.id)
              const pct = c.limit>0 ? Math.min(Math.round(spent/c.limit*100),100) : 0
              const avail = Math.max(c.limit-spent,0)
              return (
                <div key={c.id} className="rounded-xl p-3.5 transition-all relative" style={{ background:'var(--bg3)', border:'1px solid var(--border)', cursor:'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor='var(--border2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor='var(--border)'}>
                  <div className="absolute top-2.5 right-2.5 flex gap-1">
                    <button onClick={e=>{e.stopPropagation();openEditCard(c)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--muted)',padding:'3px 5px',borderRadius:5}}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();setDelCardId(c.id)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--muted)',padding:'3px 5px',borderRadius:5}}>🗑</button>
                  </div>
                  <div onClick={()=>setInvoiceCard(c)}>
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold flex-shrink-0"
                        style={{ background:(c.color||'#8b5cf6')+'22', color:c.color||'#8b5cf6' }}>
                        {c.name.slice(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{c.name}</div>
                        <div className="text-xs" style={{ color:'var(--muted)' }}>{c.brand} · vence dia {c.due}</div>
                      </div>
                      <div className="font-mono text-sm font-bold" style={{ color:c.color||'#8b5cf6' }}>R$ {fmt(spent)}</div>
                    </div>
                    <div className="h-1 rounded-full overflow-hidden mb-1" style={{ background:'rgba(255,255,255,.06)' }}>
                      <div className="h-full rounded-full" style={{ width:pct+'%', background:c.color||'#8b5cf6' }} />
                    </div>
                    <div className="text-xs text-right" style={{ color:'var(--muted)' }}>{pct}% — Disponível R$ {fmt(avail)}</div>
                  </div>
                </div>
              )
            }) : (
              <div className="text-center py-8 text-xs" style={{ color:'var(--muted)' }}>Nenhum cartão cadastrado</div>
            )}
            <div onClick={openNewCard} className="rounded-xl p-3 flex items-center justify-center gap-2 transition-all"
              style={{ border:'1px dashed var(--border)', cursor:'pointer' }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent)';(e.currentTarget as HTMLElement).style.background='var(--glow)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.background=''}}>
              <span style={{color:'var(--muted)',fontSize:14}}>＋</span>
              <span className="text-xs font-semibold" style={{color:'var(--muted)'}}>Novo Cartão</span>
            </div>
          </div>
        </div>

        {/* Resumo */}
        <div className="rounded-2xl p-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          <div className="text-sm font-bold mb-4">Resumo</div>
          <div className="flex flex-col gap-2.5">
            {[
              { label:'Total faturas (mês)', value:fmt(totalFaturas), color:'var(--purple)' },
              { label:'Limite total', value:fmt(totalLimit), color:'var(--blue)' },
              { label:'Disponível total', value:fmt(totalLimit-totalFaturas), color:'var(--green)' },
            ].map(k=>(
              <div key={k.label} className="flex justify-between px-3 py-2.5 rounded-lg" style={{background:'var(--bg3)'}}>
                <span className="text-xs" style={{color:'var(--muted)'}}>{k.label}</span>
                <span className="font-mono text-xs font-bold" style={{color:k.color}}>R$ {k.value}</span>
              </div>
            ))}
            <div className="flex justify-between px-3 py-2.5 rounded-lg" style={{background:'rgba(139,92,246,.08)',border:'1px solid rgba(139,92,246,.18)'}}>
              <span className="text-xs font-bold">Próximo vencimento</span>
              <span className="text-xs" style={{color:'var(--muted)'}}>
                {db.cards.length ? 'Dia '+Math.min(...db.cards.map(c=>c.due)) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Fatura */}
      {invoiceCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(0,0,0,.75)',backdropFilter:'blur(8px)'}}
          onClick={e=>{if(e.target===e.currentTarget)setInvoiceCard(null)}}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-screen overflow-y-auto" style={{background:'var(--card2)',border:'1px solid var(--border)',animation:'mdIn .2s ease'}}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-base font-bold">Fatura — {invoiceCard.name}</div>
              <button onClick={()=>setInvoiceCard(null)} style={{background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer'}}>✕</button>
            </div>
            <div className="text-xs mb-4" style={{color:'var(--muted)'}}>{MONTHS[curMonth]} {curYear} · Vence {invoiceCard.due}/{MONTHS[dueMonth].slice(0,3)}/{dueYear}</div>
            <div className="grid grid-cols-3 gap-2.5 mb-4">
              {[
                { label:'Fatura', value:fmt(cardSpend(invoiceCard.id)), color:'var(--purple)' },
                { label:'Utilizado', value:invoiceCard.limit>0?Math.min(Math.round(cardSpend(invoiceCard.id)/invoiceCard.limit*100),100)+'%':'0%', color:'var(--yellow)' },
                { label:'Disponível', value:fmt(Math.max(invoiceCard.limit-cardSpend(invoiceCard.id),0)), color:'var(--green)' },
              ].map(k=>(
                <div key={k.label} className="rounded-xl p-3 text-center" style={{background:'var(--bg3)'}}>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{color:'var(--muted)'}}>{k.label}</div>
                  <div className="font-mono text-base font-extrabold" style={{color:k.color}}>{k.value}</div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold" style={{color:'var(--muted)'}}>Lançamentos da fatura</div>
              <div className="flex gap-2">
                <button onClick={()=>{setImportCardId(invoiceCard.id);setImportMonth(curMonth);setImportYear(curYear);setShowImportPicker(true)}}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{background:'linear-gradient(135deg,rgba(99,102,241,.18),rgba(6,182,212,.18))',border:'1px solid rgba(99,102,241,.4)',color:'var(--accent)',cursor:'pointer',fontFamily:'Sora,sans-serif'}}>
                  📥 Importar
                </button>
                <button onClick={()=>setTxModal(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',cursor:'pointer',fontFamily:'Sora,sans-serif'}}>
                  + Lançamento
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-0.5">
              {invTxs.length ? invTxs.map(t=>(
                <div key={t.id}>
                  {editTxId === t.id ? (
                    /* Modo edição inline */
                    <div className="rounded-lg px-2.5 py-2.5 flex flex-col gap-2" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                      <div className="flex gap-2">
                        <input value={editName} onChange={e=>setEditName(e.target.value)}
                          style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 8px',fontFamily:'Sora,sans-serif',fontSize:11,color:'var(--text)',outline:'none'}} />
                        <select value={editCat} onChange={e=>setEditCat(e.target.value)}
                          style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 8px',fontFamily:'Sora,sans-serif',fontSize:11,color:'var(--text)',outline:'none',cursor:'pointer'}}>
                          {[...CATS,...customCats].map(c=><option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={()=>setEditTxId(null)}
                          style={{padding:'4px 12px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:11,cursor:'pointer'}}>
                          Cancelar
                        </button>
                        <button onClick={()=>{
                          updateTransaction({...t, name:editName, cat:editCat, icon:C_ICON[editCat]||t.icon, color:C_COLOR[editCat]||t.color})
                          setEditTxId(null)
                        }}
                          style={{padding:'4px 12px',background:'var(--accent)',border:'none',borderRadius:6,color:'#fff',fontFamily:'Sora,sans-serif',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Modo visualização */
                    <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg group relative cursor-pointer"
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=''}
                      onClick={()=>{setEditTxId(t.id);setEditCat(t.cat);setEditName(t.name)}}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                        style={{background:(C_COLOR[t.cat]||'#6b7591')+'22'}}>{t.icon||'💰'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{t.name}</div>
                        <div className="text-xs" style={{color:'var(--muted)'}}>{t.cat} · {isoToDisplay(t.dateISO)}</div>
                      </div>
                      <div className="font-mono text-xs font-bold group-hover:opacity-0" style={{color:'var(--red)'}}>- R$ {fmt(t.val)}</div>
                      <div className="absolute right-2 hidden group-hover:flex gap-1" style={{background:'var(--bg3)',borderRadius:7,padding:3}}>
                        <button onClick={e=>{e.stopPropagation();setEditTxId(t.id);setEditCat(t.cat);setEditName(t.name)}}
                          style={{background:'rgba(99,102,241,.12)',border:'none',borderRadius:5,color:'var(--accent)',cursor:'pointer',fontSize:11,padding:'3px 7px'}}>✏️</button>
                        <button onClick={e=>{e.stopPropagation();setDelTxId(t.id)}}
                          style={{background:'rgba(239,68,68,.12)',border:'none',borderRadius:5,color:'var(--red)',cursor:'pointer',fontSize:11,padding:'3px 7px'}}>🗑</button>
                      </div>
                    </div>
                  )}
                </div>
              )) : (
                <div className="text-center py-6 text-xs" style={{color:'var(--muted)'}}>Nenhum lançamento neste mês</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Picker mes/ano para importar fatura */}
      {showImportPicker && importCardId && (() => {
        const card = db.cards.find(c => c.id === importCardId)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{background:'rgba(0,0,0,.8)',backdropFilter:'blur(8px)'}}
            onClick={e=>{if(e.target===e.currentTarget)setShowImportPicker(false)}}>
            <div className="w-full max-w-xs rounded-2xl p-6" style={{background:'var(--card2)',border:'1px solid var(--border)',animation:'mdIn .2s ease'}}>
              <div className="text-base font-bold mb-1">📥 Importar Fatura</div>
              <div className="text-xs mb-4" style={{color:'var(--muted)'}}>
                Cartão: <span style={{color:'var(--accent)',fontWeight:700}}>{card?.name}</span>
              </div>
              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wide block mb-2" style={{color:'var(--muted)'}}>📅 Mês de referência</label>
                <div className="flex gap-2">
                  <select value={importMonth} onChange={e=>setImportMonth(Number(e.target.value))}
                    style={{flex:1,background:'var(--bg3)',border:'1.5px solid var(--border)',borderRadius:9,padding:'10px 12px',fontFamily:'Sora,sans-serif',fontSize:13,fontWeight:700,color:'var(--text)',outline:'none',cursor:'pointer'}}>
                    {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
                  </select>
                  <select value={importYear} onChange={e=>setImportYear(Number(e.target.value))}
                    style={{width:90,background:'var(--bg3)',border:'1.5px solid var(--border)',borderRadius:9,padding:'10px 12px',fontFamily:'Sora,sans-serif',fontSize:13,fontWeight:700,color:'var(--text)',outline:'none',cursor:'pointer'}}>
                    {[curYear-2,curYear-1,curYear,curYear+1].map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={()=>setShowImportPicker(false)}
                  style={{flex:1,padding:'11px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                  Cancelar
                </button>
                <button onClick={()=>{ setShowImportPicker(false); setInvoiceCard(null) }}
                  style={{flex:2,padding:'11px',background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                  📥 Abrir Importação
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ImportModal para cartao */}
      {!showImportPicker && importCardId && (
        <ImportModal
          onClose={()=>setImportCardId(null)}
          curMonth={importMonth}
          curYear={importYear}
          presetCardId={importCardId}
        />
      )}

      {/* Modal novo lançamento na fatura */}
      {txModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(0,0,0,.85)',backdropFilter:'blur(8px)'}}
          onClick={e=>{if(e.target===e.currentTarget)setTxModal(false)}}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{background:'var(--card2)',border:'1px solid var(--border)',animation:'mdIn .2s ease'}}>
            <div className="text-base font-bold mb-1">Novo Lançamento</div>
            <div className="text-xs mb-4" style={{color:'var(--muted)'}}>Fatura {invoiceCard?.name} — {MONTHS[curMonth]} {curYear}</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Descrição</label>
                <input value={txDesc} onChange={e=>setTxDesc(e.target.value)} placeholder="Ex: iFood, Netflix..." style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Valor (R$)</label>
                  <input type="number" value={txVal} onChange={e=>setTxVal(e.target.value)} placeholder="0,00" style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Data</label>
                  <input type="date" value={txDate} onChange={e=>setTxDate(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Categoria</label>
                <select value={txCat} onChange={e=>setTxCat(e.target.value)} style={inputStyle}>
                  {CATS.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setTxModal(false)} style={{flex:1,padding:'11px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={saveTx} style={{flex:2,padding:'11px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Salvar Despesa</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal card */}
      {cardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(0,0,0,.75)',backdropFilter:'blur(8px)'}}
          onClick={e=>{if(e.target===e.currentTarget)setCardModal(false)}}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{background:'var(--card2)',border:'1px solid var(--border)',animation:'mdIn .2s ease'}}>
            <div className="text-base font-bold mb-1">{editCardId?'Editar':'Novo'} Cartão</div>
            <div className="text-xs mb-4" style={{color:'var(--muted)'}}>Adicione um cartão de crédito</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Nome</label>
                <input value={cName} onChange={e=>setCName(e.target.value)} placeholder="Ex: Nubank, Recarga Pay..." style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Bandeira</label>
                  <select value={cBrand} onChange={e=>setCBrand(e.target.value)} style={inputStyle}>
                    {BRANDS.map(b=><option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Limite (R$)</label>
                  <input type="number" value={cLimit} onChange={e=>setCLimit(e.target.value)} placeholder="0,00" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Dia de vencimento</label>
                <input type="number" value={cDue} onChange={e=>setCDue(e.target.value)} placeholder="Ex: 6" min="1" max="31" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Cor</label>
                <div className="flex gap-2">
                  {CARD_COLORS.map(c=>(
                    <div key={c} onClick={()=>setCColor(c)} style={{width:24,height:24,borderRadius:6,background:c,cursor:'pointer',border:cColor===c?'2px solid white':'2px solid transparent'}} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setCardModal(false)} style={{flex:1,padding:'11px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={saveCard} style={{flex:2,padding:'11px',background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Salvar Cartão</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete card confirm */}
      {delCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,.75)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-xs rounded-2xl p-6" style={{background:'var(--card2)',border:'1px solid var(--border)',animation:'mdIn .2s ease'}}>
            <div className="text-base font-bold mb-2">⚠️ Excluir cartão?</div>
            <div className="text-xs mb-5" style={{color:'var(--muted)'}}>Isso também removerá todos os lançamentos vinculados.</div>
            <div className="flex gap-2">
              <button onClick={()=>setDelCardId(null)} style={{flex:1,padding:'10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={()=>{deleteCard(delCardId);setDelCardId(null)}} style={{flex:1,padding:'10px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete tx confirm */}
      {delTxId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,.85)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-xs rounded-2xl p-6" style={{background:'var(--card2)',border:'1px solid var(--border)',animation:'mdIn .2s ease'}}>
            <div className="text-base font-bold mb-2">⚠️ Excluir lançamento?</div>
            <div className="flex gap-2 mt-4">
              <button onClick={()=>setDelTxId(null)} style={{flex:1,padding:'10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={()=>{deleteTransaction(delTxId);setDelTxId(null)}} style={{flex:1,padding:'10px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
