import { useState, useMemo } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, genId, isoToDisplay, C_COLOR, C_ICON, inMonth, upToMonth } from '../lib/utils'
import type { Account, Transaction } from '../types'

interface Props { curMonth: number; curYear: number }

const ACC_ICONS: Record<string,string> = { corrente:'🏦', poupanca:'🐷', investimento:'📈', carteira:'👛', outro:'💳' }
const ACC_TYPES = [
  { val:'corrente', lbl:'Conta Corrente' }, { val:'poupanca', lbl:'Poupança' },
  { val:'investimento', lbl:'Investimento' }, { val:'carteira', lbl:'Carteira/Dinheiro' }, { val:'outro', lbl:'Outro' }
]
const COLORS = ['#6366f1','#22c55e','#06b6d4','#f59e0b','#ef4444','#8b5cf6']
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// Calcula saldo da conta ATÉ o fim do mês/ano selecionado
function balanceUpTo(accId: string, txs: Transaction[], initialBalance: number, month: number, year: number) {
  const relevant = txs.filter(t => t.accId === accId && upToMonth(t.dateISO, month, year))
  const rec  = relevant.filter(t => t.type === 'receita').reduce((s,t) => s+t.val, 0)
  const desp = relevant.filter(t => t.type === 'despesa').reduce((s,t) => s+t.val, 0)
  return initialBalance + rec - desp
}

export default function Contas({ curMonth, curYear }: Props) {
  const { db, addAccount, updateAccount, deleteAccount } = useDB()
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string|null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<Account['type']>('corrente')
  const [bal, setBal] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [delId, setDelId] = useState<string|null>(null)
  const [detailAcc, setDetailAcc] = useState<Account|null>(null)
  const [txTab, setTxTab] = useState<'all'|'month'|'despesa'|'receita'>('month')

  const active   = useMemo(() => db.accounts.filter(a => !a.archived), [db.accounts])
  const archived = useMemo(() => db.accounts.filter(a => a.archived),  [db.accounts])

  // Saldo de cada conta ATÉ o mês selecionado
  const balances = useMemo(() =>
    Object.fromEntries(active.map(a => [a.id, balanceUpTo(a.id, db.transactions, a.initialBalance||0, curMonth, curYear)])),
    [active, db.transactions, curMonth, curYear]
  )
  const total = useMemo(() => Object.values(balances).reduce((s,v) => s+v, 0), [balances])

  const inputStyle = { width:'100%', background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'9px', padding:'10px 12px', fontFamily:'Sora,sans-serif', fontSize:'13px', color:'var(--text)', outline:'none' }

  function openNew() {
    setEditId(null); setName(''); setType('corrente'); setBal(''); setColor(COLORS[0]); setModal(true)
  }
  function openEdit(a: Account, e: React.MouseEvent) {
    e.stopPropagation()
    setEditId(a.id); setName(a.name); setType(a.type)
    setBal(String(a.initialBalance||0)); setColor(a.color||COLORS[0]); setModal(true)
  }
  function save() {
    if (!name) return
    const balance = parseFloat(bal)||0
    const obj: Account = { id:editId||genId(), name, type, balance, initialBalance:balance, color }
    if (editId) updateAccount(obj)
    else addAccount(obj)
    setModal(false)
  }

  // Transações do drawer — filtradas por modo
  const accTxs = useMemo(() => {
    if (!detailAcc) return []
    let txs = db.transactions.filter(t => t.accId === detailAcc.id)
    if (txTab === 'month')   txs = txs.filter(t => inMonth(t.dateISO, curMonth, curYear))
    if (txTab === 'despesa') txs = txs.filter(t => inMonth(t.dateISO, curMonth, curYear) && t.type==='despesa')
    if (txTab === 'receita') txs = txs.filter(t => inMonth(t.dateISO, curMonth, curYear) && t.type==='receita')
    return [...txs].sort((a,b) => b.dateISO.localeCompare(a.dateISO))
  }, [detailAcc, db.transactions, txTab, curMonth, curYear])

  // Receita/despesa DO MÊS para o drawer
  const accRecMes  = useMemo(() => detailAcc ? db.transactions.filter(t=>t.accId===detailAcc.id&&inMonth(t.dateISO,curMonth,curYear)&&t.type==='receita').reduce((s,t)=>s+t.val,0) : 0, [detailAcc, db.transactions, curMonth, curYear])
  const accDespMes = useMemo(() => detailAcc ? db.transactions.filter(t=>t.accId===detailAcc.id&&inMonth(t.dateISO,curMonth,curYear)&&t.type==='despesa').reduce((s,t)=>s+t.val,0) : 0, [detailAcc, db.transactions, curMonth, curYear])
  // Saldo até o mês para a conta no drawer
  const detailBal = useMemo(() => detailAcc ? balanceUpTo(detailAcc.id, db.transactions, detailAcc.initialBalance||0, curMonth, curYear) : 0, [detailAcc, db.transactions, curMonth, curYear])

  const tabBtn = (id: 'all'|'month'|'despesa'|'receita', label: string, activeColor: string) => (
    <button onClick={() => setTxTab(id)} style={{
      padding:'6px 14px', borderRadius:20, border:'1px solid '+(txTab===id ? activeColor : 'var(--border)'),
      background: txTab===id ? activeColor+'18' : 'transparent',
      color: txTab===id ? activeColor : 'var(--muted)',
      fontFamily:'Sora,sans-serif', fontSize:'11px', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap'
    }}>{label}</button>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-lg font-extrabold">Minhas Contas</div>
          <div className="text-xs mt-0.5" style={{color:'var(--muted)'}}>
            Saldo em <span style={{color:'var(--accent)',fontWeight:700}}>{MONTHS[curMonth]} {curYear}</span> · clique para ver detalhes
          </div>
        </div>
        <button onClick={openNew} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',cursor:'pointer',fontFamily:'Sora,sans-serif'}}>
          + Nova Conta
        </button>
      </div>

      {/* Total Bar */}
      {active.length > 0 && (
        <div className="rounded-2xl p-4 mb-4 flex items-center flex-wrap gap-3" style={{background:'var(--card)',border:'1px solid var(--border)'}}>
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wide mb-1" style={{color:'var(--muted)'}}>
              Patrimônio em {MONTHS[curMonth]} {curYear}
            </div>
            <div className="font-mono text-2xl font-extrabold" style={{color:'var(--blue)'}}>R$ {fmt(total)}</div>
            <div className="text-xs mt-0.5" style={{color:'var(--muted)'}}>{active.length} conta{active.length!==1?'s':''} ativa{active.length!==1?'s':''}</div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {active.map(a => (
              <div key={a.id} onClick={() => { setDetailAcc(a); setTxTab('month') }}
                className="text-right px-3 py-1.5 rounded-lg transition-all"
                style={{background:'var(--bg3)',cursor:'pointer'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--card2)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}>
                <div className="text-xs" style={{color:'var(--muted)'}}>{a.name}</div>
                <div className="font-mono text-sm font-bold" style={{color:balances[a.id]>=0?'var(--green)':'var(--red)'}}>R$ {fmt(balances[a.id])}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        {active.map(a => (
          <div key={a.id} onClick={() => { setDetailAcc(a); setTxTab('month') }}
            className="rounded-2xl p-5 transition-all relative"
            style={{background:'var(--card)',border:'1px solid var(--border)',cursor:'pointer'}}
            onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLElement).style.borderColor='var(--border2)'}}
            onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='';(e.currentTarget as HTMLElement).style.borderColor='var(--border)'}}>
            <div className="absolute top-3 right-3 flex gap-1">
              <button onClick={e=>openEdit(a,e)} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--muted)',padding:'4px 6px',borderRadius:6}}>✏️</button>
              <button onClick={e=>{e.stopPropagation();setDelId(a.id)}} style={{background:'none',border:'none',cursor:'pointer',fontSize:13,color:'var(--muted)',padding:'4px 6px',borderRadius:6}}>🗑</button>
            </div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3" style={{background:(a.color||'#6366f1')+'22'}}>
              {ACC_ICONS[a.type]||'🏦'}
            </div>
            <div className="text-sm font-bold mb-0.5">{a.name}</div>
            <div className="text-xs uppercase tracking-wide mb-1" style={{color:'var(--muted)'}}>
              {ACC_TYPES.find(t=>t.val===a.type)?.lbl||a.type}
            </div>
            <div className="font-mono text-lg font-extrabold" style={{color:balances[a.id]>=0?'var(--green)':'var(--red)'}}>
              R$ {fmt(balances[a.id])}
            </div>
            <div className="text-xs mt-0.5" style={{color:'var(--muted)'}}>até {MONTHS[curMonth]} {curYear}</div>
            <div className="mt-3 pt-3 text-center" style={{borderTop:'1px solid var(--border)'}}>
              <span className="text-xs font-bold" style={{color:'var(--accent)'}}>VER DETALHES →</span>
            </div>
          </div>
        ))}
        <div onClick={openNew} className="rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition-all"
          style={{background:'var(--card)',border:'1px dashed var(--border)',cursor:'pointer',minHeight:130}}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent)';(e.currentTarget as HTMLElement).style.background='var(--glow)'}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.background='var(--card)'}}>
          <div className="text-2xl" style={{color:'var(--muted)'}}>＋</div>
          <div className="text-xs font-semibold" style={{color:'var(--muted)'}}>Nova Conta</div>
        </div>
      </div>

      {/* Arquivadas */}
      {archived.length > 0 && (
        <div className="rounded-2xl p-4" style={{background:'var(--card)',border:'1px solid var(--border)'}}>
          <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{color:'var(--muted)'}}>📦 Arquivadas ({archived.length})</div>
          <div className="flex gap-2 flex-wrap">
            {archived.map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg opacity-60" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                <span className="text-xs font-semibold">{a.name}</span>
                <span className="font-mono text-xs" style={{color:'var(--muted)'}}>R$ {fmt(balances[a.id]||0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DRAWER */}
      {detailAcc && (
        <div className="fixed inset-0 z-50 flex items-center justify-end"
          style={{background:'rgba(0,0,0,.6)',backdropFilter:'blur(6px)'}}
          onClick={e=>{if(e.target===e.currentTarget)setDetailAcc(null)}}>
          <div className="h-full overflow-y-auto w-full max-w-lg"
            style={{background:'var(--card2)',borderLeft:'1px solid var(--border)',animation:'slideIn .25s ease'}}>
            <div className="flex flex-col items-center py-7 px-6" style={{borderBottom:'1px solid var(--border)'}}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3"
                style={{background:(detailAcc.color||'#6366f1')+'22'}}>
                {ACC_ICONS[detailAcc.type]||'🏦'}
              </div>
              <select value={detailAcc.id}
                onChange={e => { const a=db.accounts.find(x=>x.id===e.target.value); if(a){setDetailAcc(a);setTxTab('month')} }}
                style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,padding:'5px 12px',fontFamily:'Sora,sans-serif',fontSize:13,fontWeight:700,color:'var(--text)',outline:'none',cursor:'pointer',marginBottom:4}}>
                {db.accounts.filter(a=>!a.archived).map(a=>(
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <div className="text-xs uppercase tracking-wide mb-1" style={{color:'var(--muted)'}}>
                {ACC_TYPES.find(t=>t.val===detailAcc.type)?.lbl||detailAcc.type}
              </div>
              <div className="text-xs mb-1" style={{color:'var(--muted)'}}>
                Saldo até {MONTHS[curMonth]} {curYear}
              </div>
              <div className="font-mono text-3xl font-extrabold mb-4" style={{color:detailBal>=0?'var(--green)':'var(--red)'}}>
                R$ {fmt(detailBal)}
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                <button onClick={e=>openEdit(detailAcc,e as unknown as React.MouseEvent)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'10px 16px',borderRadius:10,background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--muted2)',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'Sora,sans-serif',textTransform:'uppercase',letterSpacing:.4,minWidth:72}}>
                  <span style={{fontSize:18}}>✏️</span>Editar
                </button>
                <button onClick={()=>{setDelId(detailAcc.id);setDetailAcc(null)}} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'10px 16px',borderRadius:10,background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--muted2)',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'Sora,sans-serif',textTransform:'uppercase',letterSpacing:.4,minWidth:72}}>
                  <span style={{fontSize:18}}>🗑</span>Excluir
                </button>
                <button onClick={()=>setDetailAcc(null)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'10px 16px',borderRadius:10,background:'var(--bg3)',border:'1px solid var(--border)',color:'var(--muted2)',fontSize:10,fontWeight:700,cursor:'pointer',fontFamily:'Sora,sans-serif',textTransform:'uppercase',letterSpacing:.4,minWidth:72}}>
                  <span style={{fontSize:18}}>✕</span>Fechar
                </button>
              </div>
            </div>

            {/* Summary do mês */}
            <div className="grid grid-cols-3 gap-2 p-4" style={{borderBottom:'1px solid var(--border)'}}>
              {[
                {label:'Entradas no mês',value:fmt(accRecMes),color:'var(--green)'},
                {label:'Saídas no mês',value:fmt(accDespMes),color:'var(--red)'},
                {label:'Saldo do mês',value:fmt(accRecMes-accDespMes),color:accRecMes-accDespMes>=0?'var(--green)':'var(--red)'},
              ].map(k=>(
                <div key={k.label} className="rounded-xl p-3" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                  <div style={{color:'var(--muted)',fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:.5,marginBottom:4}}>{k.label}</div>
                  <div className="font-mono text-sm font-extrabold" style={{color:k.color}}>R$ {k.value}</div>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="p-4">
              <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{color:'var(--muted)'}}>Movimentações</div>
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {tabBtn('month', `${MONTHS[curMonth].slice(0,3)} ${curYear}`, 'var(--accent)')}
                {tabBtn('despesa','● Saídas','var(--red)')}
                {tabBtn('receita','● Entradas','var(--green)')}
                {tabBtn('all','● Histórico','var(--muted)')}
              </div>
              <div className="flex flex-col gap-0.5 max-h-96 overflow-y-auto">
                {accTxs.length ? accTxs.map((t: Transaction) => (
                  <div key={t.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg"
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg3)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=''}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                      style={{background:(C_COLOR[t.cat]||'#6b7591')+'22'}}>
                      {t.icon||C_ICON[t.cat]||'💰'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{t.name}</div>
                      <div className="text-xs" style={{color:'var(--muted)'}}>{t.cat}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-xs font-bold" style={{color:t.type==='receita'?'var(--green)':'var(--red)'}}>
                        {t.type==='receita'?'+':'-'} R$ {fmt(t.val)}
                      </div>
                      <div className="text-xs" style={{color:'var(--muted)'}}>{isoToDisplay(t.dateISO)}</div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-xs" style={{color:'var(--muted)'}}>
                    Nenhuma movimentação em {MONTHS[curMonth]} {curYear}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal conta */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(0,0,0,.75)',backdropFilter:'blur(8px)'}}
          onClick={e=>{if(e.target===e.currentTarget)setModal(false)}}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{background:'var(--card2)',border:'1px solid var(--border)',animation:'mdIn .2s ease'}}>
            <div className="text-base font-bold mb-1">{editId?'Editar':'Nova'} Conta</div>
            <div className="text-xs mb-4" style={{color:'var(--muted)'}}>Adicione uma conta bancária ou carteira</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Nome</label>
                <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Nubank, Itaú..." style={inputStyle} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Tipo</label>
                  <select value={type} onChange={e=>setType(e.target.value as Account['type'])} style={inputStyle}>
                    {ACC_TYPES.map(t=><option key={t.val} value={t.val}>{t.lbl}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Saldo Inicial (R$)</label>
                  <input type="number" value={bal} onChange={e=>setBal(e.target.value)} placeholder="0,00" style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide block mb-1" style={{color:'var(--muted)'}}>Cor</label>
                <div className="flex gap-2">
                  {COLORS.map(c=>(
                    <div key={c} onClick={()=>setColor(c)} style={{width:26,height:26,borderRadius:7,background:c,cursor:'pointer',border:color===c?'2px solid white':'2px solid transparent'}} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={()=>setModal(false)} style={{flex:1,padding:'11px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={save} style={{flex:2,padding:'11px',background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Salvar Conta</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,.75)',backdropFilter:'blur(8px)'}}>
          <div className="w-full max-w-xs rounded-2xl p-6" style={{background:'var(--card2)',border:'1px solid var(--border)',animation:'mdIn .2s ease'}}>
            <div className="text-base font-bold mb-2">⚠️ Excluir conta?</div>
            <div className="text-xs mb-5" style={{color:'var(--muted)'}}>Isso também removerá todas as transações vinculadas.</div>
            <div className="flex gap-2">
              <button onClick={()=>setDelId(null)} style={{flex:1,padding:'10px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={()=>{deleteAccount(delId);setDelId(null)}} style={{flex:1,padding:'10px',background:'linear-gradient(135deg,#ef4444,#dc2626)',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
