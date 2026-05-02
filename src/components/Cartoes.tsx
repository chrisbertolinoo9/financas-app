import { useState, useMemo } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, txBelongsToInvoice, isoToDisplay, C_COLOR, C_ICON, genId, todayISO, inMonth } from '../lib/utils'
import type { Card, Transaction } from '../types'
import ImportModal from './ImportModal'

interface Props { curMonth: number; curYear: number }

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const BRANDS = ['Visa','Mastercard','Elo','Amex','Hipercard','Outro']
const CARD_COLORS = ['#8b5cf6','#6366f1','#3b82f6','#06b6d4','#22c55e','#f59e0b','#ef4444']
const CATS = ['Alimentação','Supermercado','Moradia','Transporte','Saúde','Lazer','Airsoft','Viagem','PC','Salário','Freelance','Assinatura','Educação','Vestuário','Combustível','Benefício','Gasto Cartão','Renda Extra','Outros']

const RCP_PROXY = 'https://financas-proxy.chrisbertolinoo9.workers.dev/v1/messages'
const MONTHS_RCP = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const RCP_PROMPT = `Analise esta fatura da RecargaPay que contém múltiplos cartões.
Retorne APENAS JSON válido sem markdown:
{"transactions":[{"cardNumber":"2644","name":"descrição","val":0.00,"cat":"categoria","icon":"emoji","date":"DD/MM","parcela":"X/Y ou null"}]}

REGRAS GERAIS:
- Identifique a seção de cada cartão pelo número: "Cartão •••• •••• •••• 2644" ou "•••• 2397"
- Inclua cardNumber com "2644" ou "2397" conforme a seção
- Todas as transações são despesas
- Valores numéricos puros sem R$ (ex: 165.00)
- Descrição: copie EXATAMENTE como aparece no extrato, sem resumir
- Se houver parcela como (1/12) ou (2/4) no nome, extraia para o campo parcela (ex: "1/12"). Caso contrário, parcela = null
- Ignore seções "Próxima fatura", "Total de compras parceladas", encargos e simulações
- Inclua TODAS as transações de ambos os cartões

REGRAS DE CATEGORIZAÇÃO (aplicar automaticamente):

Assinatura (icon: 📱):
- "Pg Nio Fibrario" → cat="Moradia", icon="🏠" (internet fibra)
- Qualquer "DI Google" → cat="Assinatura", icon="📱" (Google One, Strava, YouTube, Mobile, etc.)
- "Ebn Sonyplaystat" → cat="Games", icon="🎮" (PlayStation)
- "Apoiase" ou "Apoia.se" → cat="Assinatura", icon="📱" (plataforma criadores)
- "Amazon Prime" → cat="Assinatura", icon="📱"
- "Netflix" → cat="Assinatura", icon="📱"
- "Spotify" → cat="Assinatura", icon="📱"
- "DI Google Chatgpsao" ou "ChatGPT" ou "Openai" → cat="Assinatura", icon="📱"
- "Uninter" ou "UNINTER" → cat="Educação", icon="📚"

Alimentação (icon: 🍽️):
- "Mercearia Prontacuritibra" → cat="Alimentação", icon="🛒"
- "Ifd" (iFood) + qualquer nome → cat="Alimentação", icon="🍽️" (delivery)
- "Ifd Fruta" ou açaí → cat="Alimentação", icon="🍽️"
- "Arrigo Franco" → cat="Alimentação", icon="🍽️" (restaurante)
- "Guappo Barbeariacuritibra" → cat="Lazer", icon="✂️" (barbearia)

Supermercado (icon: 🛒):
- "Supermercado Festval" → cat="Supermercado", icon="🛒"
- "Ifd Wms" (Maxxi/BIG via iFood) → cat="Supermercado", icon="🛒"
- "Filial" + número → cat="Supermercado", icon="🛒"
- "Marcio Popilarz" → cat="Supermercado", icon="🛒"
- "Mercadolivre" → cat="Outros", icon="📦" (produto genérico — não sabe o que é)

Saúde (icon: 💊):
- "Souzamed" ou "farmácia" ou "drogaria" → cat="Saúde", icon="💊"

Transporte (icon: 🚗):
- "Brava Motors" → cat="Transporte", icon="🚗" (moto/carro)
- "Uber" ou "99" ou "Cabify" → cat="Transporte", icon="🚗"

Games (icon: 🎮):
- "Sonyplaystat" ou "PlayStation" ou "Xbox" ou "Steam" ou "Nintendo" → cat="Games", icon="🎮"

CATEGORIAS disponíveis: Alimentação, Supermercado, Moradia, Transporte, Saúde, Lazer, Airsoft, Assinatura, Educação, Vestuário, Combustível, Games, Gasto Cartão, Renda Extra, Outros`

interface RcpRow {
  _id: number
  _sel: boolean
  _dup: boolean
  cardNumber: string
  name: string
  val: number
  cat: string
  icon: string
  date: string
  dateISO: string
  parcela: string | null
}

export default function Cartoes({ curMonth, curYear }: Props) {
  const { db, save, addCard, updateCard, deleteCard, addTransaction, updateTransaction, deleteTransaction } = useDB()
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
  const [editType, setEditType] = useState<'receita'|'despesa'>('despesa')
  const [customCats, setCustomCats] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('fp_custom_import_cats') || '[]') } catch { return [] }
  })
  const allCats = [...CATS, ...customCats.filter(c => !CATS.includes(c))]
  const [newCatMode, setNewCatMode] = useState(false)
  const [newCatVal, setNewCatVal] = useState('')

  function addCustomCat(name: string) {
    if (!name.trim() || allCats.includes(name.trim())) return name.trim()
    const nc = name.trim()
    const updated = [...customCats, nc]
    setCustomCats(updated)
    localStorage.setItem('fp_custom_import_cats', JSON.stringify(updated))
    return nc
  }
  const [importCardId, setImportCardId] = useState<string|null>(null)
  const [importMonth, setImportMonth] = useState(curMonth)
  const [importYear, setImportYear] = useState(curYear)
  const [showRecargaPay, setShowRecargaPay] = useState(false)
  const [rcpMonth, setRcpMonth] = useState(curMonth)
  const [rcpYear, setRcpYear]   = useState(curYear)
  const [rcpFile, setRcpFile]   = useState<{file:File;dataUrl:string;name:string}|null>(null)
  const [rcpStep, setRcpStep]   = useState<'upload'|'loading'|'review'|'done'>('upload')
  const [rcpRows2644, setRcpRows2644] = useState<RcpRow[]>([])
  const [rcpRows2397, setRcpRows2397] = useState<RcpRow[]>([])
  const [rcpImported, setRcpImported] = useState(0)
  const [rcpProg, setRcpProg]   = useState(0)
  const [rcpMsg, setRcpMsg]     = useState('Processando...')
  const [showImportPicker, setShowImportPicker] = useState(false)

  function cardSpend(cardId: string) {
    const card = db.cards.find(c => c.id === cardId)
    if (!card) return 0
    return db.transactions
      .filter(t => t.cardId === cardId && txBelongsToInvoice(t, card, curMonth, curYear))
      .reduce((s, t) => t.type === 'receita' ? s - t.val : s + t.val, 0)
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

  const CATS_RCP = ['Alimentação','Supermercado','Moradia','Transporte','Saúde','Lazer','Airsoft','Salário','Freelance','Assinatura','Educação','Vestuário','Combustível','Benefício','Games','Gasto Cartão','Renda Extra','Outros']

  function rcpIsDup(name: string, val: number, dateISO: string) {
    return db.transactions.some(t =>
      t.name.toLowerCase() === name.toLowerCase() &&
      Math.abs(t.val - val) < 0.02 &&
      t.dateISO === dateISO
    )
  }

  async function rcpRunAI() {
    if (!rcpFile) return
    setRcpStep('loading'); setRcpProg(0); setRcpMsg('Lendo fatura...')
    const pInt = setInterval(() => setRcpProg(p => Math.min(p + 8, 88)), 500)
    try {
      const isPdf = rcpFile.file.type === 'application/pdf' || rcpFile.name.endsWith('.pdf')
      const contentArr: object[] = []
      if (isPdf) {
        contentArr.push({ type:'document', source:{ type:'base64', media_type:'application/pdf', data: rcpFile.dataUrl.split(',')[1] } })
      } else {
        contentArr.push({ type:'image', source:{ type:'base64', media_type: rcpFile.file.type||'image/jpeg', data: rcpFile.dataUrl.split(',')[1] } })
      }
      contentArr.push({ type:'text', text: RCP_PROMPT })
      const headers: Record<string,string> = { 'Content-Type':'application/json' }
      if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25'
      const resp = await fetch(RCP_PROXY, { method:'POST', headers, body: JSON.stringify({ model:'claude-opus-4-5', max_tokens:4000, messages:[{ role:'user', content: contentArr }] }) })
      const data = await resp.json()
      clearInterval(pInt)
      if (data.error) throw new Error(data.error.message)
      const raw = data.content.map((b: {text?:string}) => b.text||'').join('').replace(/```json|```/g,'').trim()
      const extracted = JSON.parse(raw)
      const mm = String(rcpMonth + 1).padStart(2,'0')
      const rows: RcpRow[] = (extracted.transactions||[]).map((t: {cardNumber:string;name:string;val:number;cat:string;icon:string;date:string;parcela:string|null}, i: number) => {
        const parts = (t.date||'').split('/')
        const dateISO = parts.length===2 ? `${rcpYear}-${mm}-${parts[0].padStart(2,'0')}` : `${rcpYear}-${mm}-01`
        return {
          _id: i, _sel: true, _dup: rcpIsDup(t.name, t.val, dateISO),
          cardNumber: t.cardNumber || '2644',
          name: t.name, val: t.val, cat: t.cat, icon: t.icon||'💳',
          date: t.date, dateISO,
          parcela: t.parcela || null,
        }
      })
      setRcpProg(100)
      setRcpRows2644(rows.filter(r => r.cardNumber === '2644'))
      setRcpRows2397(rows.filter(r => r.cardNumber === '2397'))
      await new Promise(r => setTimeout(r, 300))
      setRcpStep('review')
    } catch(e) {
      clearInterval(pInt)
      setRcpMsg('Erro: ' + String(e))
      setTimeout(() => setRcpStep('upload'), 3000)
    }
  }

  function rcpDoImport() {
    const card2644 = db.cards.find(c => c.name.includes('2644'))
    const card2397 = db.cards.find(c => c.name.includes('2397'))
    const allNew: Transaction[] = []
    const futureParcelas: Transaction[] = []

    const processRows = (rows: RcpRow[], card: typeof card2644) => {
      if (!card) return
      rows.filter(r => r._sel).forEach(r => {
        const tx: Transaction = {
          id: genId(), name: r.name, cat: r.cat, type: 'despesa', val: r.val,
          dateISO: r.dateISO, date: isoToDisplay(r.dateISO),
          icon: r.icon || C_ICON[r.cat] || '💳',
          color: C_COLOR[r.cat] || '#6b7591',
          accId: null, cardId: card.id, toAccId: null,
          invoiceMonth: rcpMonth, invoiceYear: rcpYear,
        }
        allNew.push(tx)
        // Parcelas futuras
        if (r.parcela) {
          const match = r.parcela.match(/^(\d+)\/(\d+)$/)
          if (match) {
            const cur = parseInt(match[1]); const tot = parseInt(match[2])
            for (let i = 1; i <= tot - cur; i++) {
              let futM = rcpMonth + i; let futY = rcpYear
              while (futM > 11) { futM -= 12; futY++ }
              futureParcelas.push({
                id: genId(),
                name: r.name.replace(/\(\d+\/\d+\)/, `(${cur+i}/${tot})`),
                cat: r.cat, type: 'despesa', val: r.val,
                dateISO: futY + '-' + String(futM+1).padStart(2,'0') + '-01',
                date: '01/' + String(futM+1).padStart(2,'0'),
                icon: tx.icon, color: tx.color,
                accId: null, cardId: card.id, toAccId: null,
                invoiceMonth: futM, invoiceYear: futY,
              })
            }
          }
        }
      })
    }

    processRows(rcpRows2644, card2644)
    processRows(rcpRows2397, card2397)

    const total = allNew.length + futureParcelas.length
    save({ ...db, transactions: [...allNew, ...futureParcelas, ...db.transactions] })
    setRcpImported(total)
    setRcpStep('done')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-lg font-extrabold">Cartões de Crédito</div>
          <div className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>Clique em um cartão para ver a fatura</div>
        </div>
        <div className="flex gap-2">
          <button onClick={()=>{setShowRecargaPay(true);setRcpStep('upload');setRcpFile(null);setRcpMonth(curMonth);setRcpYear(curYear)}}
            className="px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background:'var(--bg3)', border:'1px solid rgba(245,158,11,.4)', color:'#f59e0b', cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
            📄 Importar RecargaPay
          </button>
          <button onClick={openNewCard} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background:'linear-gradient(135deg,var(--accent),var(--accent2))', border:'none', cursor:'pointer', fontFamily:'Sora,sans-serif' }}>
            + Novo Cartão
          </button>
        </div>
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

        {/* Resumo + Relatório */}
        <div className="flex flex-col gap-4">

          {/* Resumo rápido */}
          <div className="rounded-2xl p-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="text-sm font-bold mb-3">Resumo</div>
            <div className="flex flex-col gap-2">
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

          {/* Gastos por cartão no mês */}
          <div className="rounded-2xl p-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="text-sm font-bold mb-3">🧾 Gastos por Cartão</div>
            {cardReport.length === 0 ? (
              <div className="text-center py-4 text-xs" style={{color:'var(--muted)'}}>Sem gastos no mês</div>
            ) : (
              <div className="flex flex-col gap-3">
                {cardReport.map(({card, cats, total, txCount}) => {
                  const topCats = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,4)
                  const maxCat = topCats[0]?.[1] || 1
                  return (
                    <div key={card.id} className="rounded-xl p-3" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-xs font-bold">{card.name}</div>
                          <div className="text-xs" style={{color:'var(--muted)'}}>{txCount} lançamento{txCount!==1?'s':''}</div>
                        </div>
                        <div className="font-mono text-sm font-extrabold" style={{color:'var(--red)'}}>R$ {fmt(total)}</div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {topCats.map(([cat,val])=>(
                          <div key={cat}>
                            <div className="flex justify-between mb-0.5">
                              <span className="text-xs" style={{color:'var(--muted)'}}>{cat}</span>
                              <span className="font-mono text-xs font-semibold">R$ {fmt(val)}</span>
                            </div>
                            <div className="h-1 rounded-full overflow-hidden" style={{background:'rgba(255,255,255,.06)'}}>
                              <div className="h-full rounded-full" style={{width:Math.round(val/maxCat*100)+'%',background:C_COLOR[cat]||'#6b7591'}} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Alimentação das contas */}
          <div className="rounded-2xl p-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
            <div className="text-sm font-bold mb-1">🍽️ Alimentação nas Contas</div>
            <div className="text-xs mb-3" style={{color:'var(--muted)'}}>Alimentação + Supermercado debitados direto nas contas</div>
            {accAlimentacao.length === 0 ? (
              <div className="text-center py-4 text-xs" style={{color:'var(--muted)'}}>Sem gastos de alimentação nas contas</div>
            ) : (
              <div className="flex flex-col gap-2">
                {accAlimentacao.map(({acc,total})=>(
                  <div key={acc.id} className="flex justify-between items-center px-3 py-2.5 rounded-lg" style={{background:'var(--bg3)'}}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{background:acc.color||'#6b7591'}} />
                      <span className="text-xs font-semibold">{acc.name}</span>
                    </div>
                    <span className="font-mono text-xs font-bold" style={{color:'var(--red)'}}>- R$ {fmt(total)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center px-3 py-2.5 rounded-lg mt-1" style={{background:'rgba(234,179,8,.07)',border:'1px solid rgba(234,179,8,.2)'}}>
                  <span className="text-xs font-bold">Total alimentação (contas)</span>
                  <span className="font-mono text-xs font-extrabold" style={{color:'#eab308'}}>R$ {fmt(accAlimentacao.reduce((s,r)=>s+r.total,0))}</span>
                </div>
              </div>
            )}
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
                        <select value={editType} onChange={e=>setEditType(e.target.value as 'receita'|'despesa')}
                          style={{width:90,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 6px',fontFamily:'Sora,sans-serif',fontSize:11,color:editType==='receita'?'var(--green)':'var(--red)',outline:'none',cursor:'pointer',fontWeight:700}}>
                          <option value="despesa">↓ Despesa</option>
                          <option value="receita">↑ Receita</option>
                        </select>
                        {newCatMode ? (
                          <input autoFocus value={newCatVal} onChange={e=>setNewCatVal(e.target.value)}
                            onKeyDown={e=>{
                              if(e.key==='Enter'){const nc=addCustomCat(newCatVal);setEditCat(nc);setNewCatMode(false);setNewCatVal('')}
                              if(e.key==='Escape'){setNewCatMode(false);setNewCatVal('')}
                            }}
                            placeholder="Nova categoria... (Enter)"
                            style={{flex:1,background:'var(--bg)',border:'1px solid var(--accent)',borderRadius:7,padding:'5px 8px',fontFamily:'Sora,sans-serif',fontSize:11,color:'var(--text)',outline:'none'}} />
                        ) : (
                          <select value={editCat} onChange={e=>{
                            if(e.target.value==='__new__'){setNewCatMode(true);setNewCatVal('')}
                            else setEditCat(e.target.value)
                          }}
                            style={{flex:1,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 8px',fontFamily:'Sora,sans-serif',fontSize:11,color:'var(--text)',outline:'none',cursor:'pointer'}}>
                            {allCats.map(c=><option key={c}>{c}</option>)}
                            <option value="__new__">＋ Nova categoria</option>
                          </select>
                        )}
                      </div>
                      <div className="flex gap-1.5 justify-end">
                        <button onClick={()=>setEditTxId(null)}
                          style={{padding:'4px 12px',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:11,cursor:'pointer'}}>
                          Cancelar
                        </button>
                        <button onClick={()=>{
                          updateTransaction({...t, name:editName, cat:editCat, type:editType, icon:C_ICON[editCat]||t.icon, color:C_COLOR[editCat]||t.color})
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
                      onClick={()=>{setEditTxId(t.id);setEditCat(t.cat);setEditName(t.name);setEditType(t.type==='receita'?'receita':'despesa')}}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                        style={{background:(C_COLOR[t.cat]||'#6b7591')+'22'}}>{t.icon||'💰'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold truncate">{t.name}</div>
                        <div className="text-xs" style={{color:'var(--muted)'}}>{t.cat} · {isoToDisplay(t.dateISO)}</div>
                      </div>
                      <div className="font-mono text-xs font-bold group-hover:opacity-0" style={{color:'var(--red)'}}>- R$ {fmt(t.val)}</div>
                      <div className="absolute right-2 hidden group-hover:flex gap-1" style={{background:'var(--bg3)',borderRadius:7,padding:3}}>
                        <button onClick={e=>{e.stopPropagation();setEditTxId(t.id);setEditCat(t.cat);setEditName(t.name);setEditType(t.type==='receita'?'receita':'despesa')}}
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


      {/* ── Modal RecargaPay ── */}
      {showRecargaPay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{background:'rgba(0,0,0,.8)',backdropFilter:'blur(8px)'}}
          onClick={e=>{if(e.target===e.currentTarget){setShowRecargaPay(false)}}}>
          <div className="w-full rounded-2xl p-6 overflow-y-auto"
            style={{background:'var(--card2)',border:'1px solid var(--border)',maxWidth:680,maxHeight:'92vh',animation:'mdIn .2s ease'}}>

            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-base font-bold">📄 Importar RecargaPay</div>
                <div className="text-xs mt-0.5" style={{color:'var(--muted)'}}>Fatura com múltiplos cartões — importa 2644 e 2397 de uma vez</div>
              </div>
              <button onClick={()=>setShowRecargaPay(false)} style={{background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer'}}>✕</button>
            </div>

            {/* Steps */}
            <div className="flex items-center mb-5">
              {['Upload','Análise IA','Revisão','Concluído'].map((lbl,i)=>{
                const n = i+1
                const s = rcpStep==='upload'?1:rcpStep==='loading'?2:rcpStep==='review'?3:4
                return (
                  <div key={lbl} className="flex items-center" style={{flex:i<3?1:'auto'}}>
                    <div className="flex items-center gap-1.5">
                      <div style={{width:22,height:22,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,flexShrink:0,
                        background:s>n?'var(--green)':s===n?'var(--accent)':'var(--bg3)',
                        border:`1px solid ${s>n?'var(--green)':s===n?'var(--accent)':'var(--border)'}`,
                        color:s>=n?'#fff':'var(--muted)'}}>
                        {s>n?'✓':n}
                      </div>
                      <span className="text-xs font-semibold" style={{color:s===n?'var(--text)':'var(--muted)',whiteSpace:'nowrap'}}>{lbl}</span>
                    </div>
                    {i<3 && <div className="flex-1 h-px mx-2" style={{background:'var(--border)'}} />}
                  </div>
                )
              })}
            </div>

            {/* UPLOAD */}
            {rcpStep==='upload' && (
              <div className="flex flex-col gap-4">
                <div className="rounded-xl p-3" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                  <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{color:'var(--muted)'}}>📅 Mês de referência</div>
                  <div className="flex gap-2">
                    <select value={rcpMonth} onChange={e=>setRcpMonth(Number(e.target.value))}
                      style={{flex:1,background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:8,padding:'9px 12px',fontFamily:'Sora,sans-serif',fontSize:13,fontWeight:700,color:'var(--text)',outline:'none',cursor:'pointer'}}>
                      {MONTHS_RCP.map((m,i)=><option key={i} value={i}>{m}</option>)}
                    </select>
                    <select value={rcpYear} onChange={e=>setRcpYear(Number(e.target.value))}
                      style={{width:100,background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:8,padding:'9px 12px',fontFamily:'Sora,sans-serif',fontSize:13,fontWeight:700,color:'var(--text)',outline:'none',cursor:'pointer'}}>
                      {[curYear-2,curYear-1,curYear,curYear+1].map(y=><option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div className="relative rounded-xl p-8 text-center"
                  style={{border:'2px dashed var(--border)',cursor:'pointer'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='#f59e0b'}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)'}}>
                  <input type="file" accept="image/*,application/pdf,.pdf" onChange={e=>{
                    const file = e.target.files?.[0]; if(!file) return
                    const reader = new FileReader()
                    reader.onload = ev => setRcpFile({file, dataUrl: ev.target?.result as string, name: file.name})
                    reader.readAsDataURL(file)
                  }} style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}} />
                  {rcpFile ? (
                    <div>
                      <div className="text-2xl mb-1">📄</div>
                      <div className="text-sm font-bold" style={{color:'#f59e0b'}}>{rcpFile.name}</div>
                      <div className="text-xs mt-1" style={{color:'var(--muted)'}}>clique para trocar</div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-3xl mb-2">🖼️</div>
                      <div className="text-sm font-bold mb-1">Selecione a fatura RecargaPay</div>
                      <div className="text-xs" style={{color:'var(--muted)'}}>PDF ou imagem — com os dois cartões juntos</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end">
                  <button onClick={()=>setShowRecargaPay(false)} style={{padding:'10px 20px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
                  <button onClick={rcpRunAI} disabled={!rcpFile}
                    style={{padding:'10px 20px',background:rcpFile?'linear-gradient(135deg,#f59e0b,#d97706)':'var(--bg3)',border:'none',borderRadius:'9px',color:rcpFile?'#fff':'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:rcpFile?'pointer':'not-allowed'}}>
                    ✨ Analisar com IA
                  </button>
                </div>
              </div>
            )}

            {/* LOADING */}
            {rcpStep==='loading' && (
              <div className="py-8">
                <div className="rounded-xl p-5" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                  <div className="text-sm font-bold mb-1">{rcpMsg}</div>
                  <div className="text-xs mb-3" style={{color:'var(--muted)'}}>Separando transações por cartão...</div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{background:'var(--bg)'}}>
                    <div className="h-full rounded-full transition-all" style={{width:rcpProg+'%',background:'linear-gradient(90deg,#f59e0b,#d97706)'}} />
                  </div>
                  <div className="text-xs text-right mt-1" style={{color:'var(--muted)'}}>{Math.round(rcpProg)}%</div>
                </div>
              </div>
            )}

            {/* REVISÃO */}
            {rcpStep==='review' && (
              <div className="flex flex-col gap-4">
                {[{label:'💳 Recarga Pay 2644', rows:rcpRows2644, setter:setRcpRows2644, color:'var(--accent)'},{label:'💳 Recarga Pay 2397 - Dai', rows:rcpRows2397, setter:setRcpRows2397, color:'var(--cyan)'}].map(({label,rows,setter,color})=>(
                  <div key={label} className="rounded-xl overflow-hidden" style={{border:'1px solid var(--border)'}}>
                    <div className="flex items-center justify-between px-4 py-2.5" style={{background:'var(--bg3)',borderBottom:'1px solid var(--border)'}}>
                      <span className="text-xs font-bold" style={{color}}>{label}</span>
                      <span className="text-xs" style={{color:'var(--muted)'}}>{rows.filter(r=>r._sel).length} selecionados · R$ {fmt(rows.filter(r=>r._sel).reduce((s,r)=>s+r.val,0))}</span>
                    </div>
                    {rows.length === 0 ? (
                      <div className="text-center py-4 text-xs" style={{color:'var(--muted)'}}>Nenhuma transação detectada</div>
                    ) : (
                      <div style={{maxHeight:200,overflowY:'auto'}}>
                        <div className="grid gap-1 px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{gridTemplateColumns:'20px 1fr 85px 50px 48px 70px',color:'var(--muted)',borderBottom:'1px solid var(--border)',background:'var(--bg3)',fontSize:8}}>
                          <div/><div>Descrição</div><div>Categoria</div><div>Data</div><div>Parc.</div><div>Valor</div>
                        </div>
                        {rows.map((r,i)=>(
                          <div key={r._id} className="grid gap-1 px-3 py-1.5 items-center"
                            style={{gridTemplateColumns:'20px 1fr 85px 50px 48px 70px',borderBottom:'1px solid var(--border)',background:r._dup?'rgba(239,68,68,.04)':'',opacity:r._sel?1:.45}}>
                            <div onClick={()=>setter(p=>p.map((x,j)=>j===i?{...x,_sel:!x._sel}:x))}
                              style={{width:15,height:15,borderRadius:3,border:'1px solid var(--border)',background:r._sel?color:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,cursor:'pointer',color:'#fff',flexShrink:0}}>
                              {r._sel?'✓':''}
                            </div>
                            <div className="text-xs truncate font-medium" title={r.name}>{r._dup?'⚠️ ':''}{r.name}</div>
                            <select value={r.cat} onChange={e=>setter(p=>p.map((x,j)=>j===i?{...x,cat:e.target.value}:x))}
                              style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:5,padding:'2px 4px',fontFamily:'Sora,sans-serif',fontSize:9,color:'var(--text)',outline:'none',width:'100%'}}>
                              {CATS_RCP.map(c=><option key={c}>{c}</option>)}
                            </select>
                            <div className="text-xs" style={{color:'var(--muted)'}}>{r.date}</div>
                            <div className="text-xs text-center" style={{color:'var(--muted)'}}>{r.parcela||'—'}</div>
                            <div className="font-mono text-xs font-bold text-right" style={{color:'var(--red)'}}>- {fmt(r.val)}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex gap-2 justify-end">
                  <button onClick={()=>setRcpStep('upload')} style={{padding:'10px 20px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>← Voltar</button>
                  <button onClick={rcpDoImport}
                    style={{padding:'10px 24px',background:'linear-gradient(135deg,#f59e0b,#d97706)',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                    Importar {rcpRows2644.filter(r=>r._sel).length + rcpRows2397.filter(r=>r._sel).length} lançamentos
                  </button>
                </div>
              </div>
            )}

            {/* CONCLUÍDO */}
            {rcpStep==='done' && (
              <div className="text-center py-10">
                <div className="text-5xl mb-3">✅</div>
                <div className="text-lg font-extrabold mb-2">{rcpImported} lançamento{rcpImported!==1?'s':''} importado{rcpImported!==1?'s':''}!</div>
                <div className="text-xs mb-6" style={{color:'var(--muted)'}}>Salvos nos dois cartões e sincronizados na nuvem.</div>
                <div className="flex gap-3 justify-center">
                  <button onClick={()=>{setRcpStep('upload');setRcpFile(null)}} style={{padding:'10px 20px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                    📄 Importar outra fatura
                  </button>
                  <button onClick={()=>setShowRecargaPay(false)} style={{padding:'10px 20px',background:'linear-gradient(135deg,#f59e0b,#d97706)',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                    Ver Cartões
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  )
}
