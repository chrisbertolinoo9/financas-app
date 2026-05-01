import { useState, useRef } from 'react'
import { useDB } from '../contexts/DBContext'
import { C_COLOR, C_ICON, isoToDisplay, genId, fmt } from '../lib/utils'
import type { Transaction } from '../types'

const PROXY = 'https://financas-proxy.chrisbertolinoo9.workers.dev/v1/messages'
const CATS = ['Alimentação','Supermercado','Moradia','Transporte','Saúde','Lazer','Airsoft','Salário','Freelance','Assinatura','Educação','Vestuário','Combustível','Benefício','Gasto Cartão','Renda Extra','Outros']

const AI_PROMPT = `Analise este extrato bancário brasileiro. Retorne APENAS JSON válido sem markdown:
{"transactions":[{"name":"descrição curta","val":0.00,"type":"receita|despesa|transferencia","cat":"categoria","date":"DD/MM","icon":"emoji"}]}

REGRAS DE CLASSIFICAÇÃO:

TRANSFERENCIAS (type="transferencia") — NÃO são receita nem despesa:
- Qualquer movimentação entre contas do MESMO titular (mesmo CPF, bancos diferentes)
- "Transferência enviada pelo Pix CHRISTIAN BERTOLINO" → transferencia
- "Transferência recebida pelo Pix CHRISTIAN BERTOLINO" → transferencia
- "Transferência enviada pelo Pix DAIANA VITORIA" saída → transferencia
- Pix para 99PAY / de 99PAY → transferencia (movimentação entre contas próprias)
- Pix para Banco XP / Rico → transferencia
- "Depósito Recebido por Boleto" → transferencia (benefício Swile transferido para conta)
- Pix recebido de DAIANA VITORIA → transferencia (repasse entre casal)

RECEITAS (type="receita"):
- "CAIXA ECONOMICA FEDERAL" entrada → receita, cat="Renda Extra", icon="💰" (FGTS aniversário)
- Pix recebido do Santander com nome CHRISTIAN BERTOLINO → receita, cat="Salário", icon="💼"
- "CLAUDETE" ou nome de familiar → receita, cat="Renda Extra", icon="💰"
- Rendimentos, cashback, estorno → receita, cat="Renda Extra"

DESPESAS (type="despesa"):
- "RECARGAPAY" saída → despesa, cat="Gasto Cartão", icon="💳"
- "Pagamento de fatura" → despesa, cat="Gasto Cartão", icon="💳"
- "Banco XP" saída → despesa, cat="Gasto Cartão", icon="💳"
- "UNINTER" → despesa, cat="Educação", icon="📚"
- "TELEFONICA" ou "VIVO" ou "CLARO" ou "TIM" → despesa, cat="Assinatura", icon="📱"
- "MARCIO POPILARZ" → despesa, cat="Supermercado", icon="🛒"
- "PJBANK" → despesa, cat="Moradia", icon="🏠" (aluguel)
- "Even3" ou eventos de airsoft → despesa, cat="Airsoft", icon="🎯"
- iFood, restaurantes, lanchonetes → despesa, cat="Alimentação", icon="🍽️"
- Supermercados, mercearias, açougues → despesa, cat="Supermercado", icon="🛒"
- Pagamento de boleto para empresas → despesa, cat="Outros"
- Demais compras e serviços → despesa com categoria adequada

CATEGORIAS disponíveis: Alimentação, Supermercado, Moradia, Transporte, Saúde, Lazer, Airsoft, Salário, Freelance, Assinatura, Educação, Vestuário, Combustível, Benefício, Gasto Cartão, Renda Extra, Outros

IMPORTANTE:
- Valores numéricos puros sem R$ ou pontos de milhar (ex: 1234.56)
- Descrição curta e legível (máximo 40 caracteres)
- Para transferencias, adicione o campo "dir":"in" se o dinheiro ENTROU na conta ou "dir":"out" se SAIU
- Se não houver transações retorne transactions:[]
- Inclua TODAS as transações, inclusive transferências`

interface PendingRow {
  _id: number
  _sel: boolean
  _dup: boolean
  name: string
  val: number
  type: 'receita' | 'despesa' | 'transferencia'
  dir?: 'in' | 'out'
  cat: string
  icon: string
  date: string
  dateISO: string
}

interface Props {
  onClose: () => void
  curMonth: number
  curYear: number
  presetAccId?: string | null
}

export default function ImportModal({ onClose, curMonth, curYear, presetAccId }: Props) {
  const { db, save } = useDB()
  const [step, setStep] = useState(1)
  const [files, setFiles] = useState<{file: File; dataUrl: string; type: 'image'|'pdf'; name: string}[]>([])
  const [destType, setDestType] = useState<'none'|'card'|'acc'>(presetAccId ? 'acc' : 'none')
  const [destId, setDestId] = useState(presetAccId || '')
  const [pending, setPending] = useState<PendingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [aiMsg, setAiMsg] = useState('Processando...')
  const [aiSub, setAiSub] = useState('Identificando transações')
  const [prog, setProg] = useState(0)
  const [imported, setImported] = useState(0)
  const [refMonth, setRefMonth] = useState(curMonth)
  const [refYear, setRefYear]   = useState(curYear)
  const fileRef = useRef<HTMLInputElement>(null)

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
  const presetAcc = presetAccId ? db.accounts.find(a => a.id === presetAccId) : null

  function isDup(name: string, val: number) {
    return db.transactions.some(t => t.name.toLowerCase() === name.toLowerCase() && Math.abs(t.val - val) < 0.02)
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || [])
    newFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
        setFiles(prev => [...prev, { file, dataUrl, type: isPdf ? 'pdf' : 'image', name: file.name }])
      }
      reader.readAsDataURL(file)
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
  }

  async function runAI() {
    if (!files.length) return
    setStep(2); setLoading(true); setProg(0)
    const msgs = [
      ['Lendo arquivo...','Identificando texto'],
      ['Detectando tabelas...','Localizando transações'],
      ['Extraindo dados...','Datas, valores, descrições'],
      ['Classificando...','Aplicando regras de categorização'],
      ['Verificando duplicatas...','Comparando histórico'],
    ]
    let mi = 0
    const mInt = setInterval(() => { if (mi < msgs.length) { setAiMsg(msgs[mi][0]); setAiSub(msgs[mi][1]); mi++ } }, 900)
    const pInt = setInterval(() => setProg(p => Math.min(p + Math.random()*14+2, 88)), 400)
    try {
      const content: object[] = []
      const hasPdf = files.some(f => f.type === 'pdf')
      for (const f of files) {
        if (f.type === 'pdf') {
          content.push({ type:'document', source:{ type:'base64', media_type:'application/pdf', data: f.dataUrl.split(',')[1] } })
        } else {
          content.push({ type:'image', source:{ type:'base64', media_type: f.file.type||'image/jpeg', data: f.dataUrl.split(',')[1] } })
        }
      }
      content.push({ type:'text', text: AI_PROMPT })
      const headers: Record<string,string> = { 'Content-Type':'application/json' }
      if (hasPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25'
      const resp = await fetch(PROXY, { method:'POST', headers, body: JSON.stringify({ model:'claude-opus-4-5', max_tokens:4000, messages:[{ role:'user', content }] }) })
      const data = await resp.json()
      clearInterval(mInt); clearInterval(pInt)
      if (data.error) throw new Error(data.error.message)
      const raw = data.content.map((b: {text?:string}) => b.text||'').join('').replace(/```json|```/g,'').trim()
      const extracted = JSON.parse(raw)
      const year = refYear
      const month = (refMonth+1).toString().padStart(2,'0')
      const rows: PendingRow[] = (extracted.transactions||[]).map((t: {name:string;val:number;type:'receita'|'despesa'|'transferencia';cat:string;icon:string;date:string}, i: number) => {
        const parts = (t.date||'').split('/')
        const dateISO = parts.length===2 ? `${year}-${month}-${parts[0].padStart(2,'0')}` : `${year}-${month}-01`
        const dup = isDup(t.name, t.val)
        return { ...t, _id:i, _sel:!dup, _dup:dup, dateISO, dir: t.dir || (t.type === 'transferencia' ? 'out' : undefined) }
      })
      setProg(100); setAiMsg('Concluído!'); setAiSub('')
      await new Promise(r => setTimeout(r, 400))
      setPending(rows); setStep(3)
    } catch(e) {
      clearInterval(mInt); clearInterval(pInt)
      setAiMsg('Erro na análise'); setAiSub(String(e))
      setTimeout(() => setStep(1), 3000)
    } finally { setLoading(false) }
  }

  function doImport() {
    const toImp = pending.filter(r => r._sel)
    if (!toImp.length) return
    const finalCardId = destType==='card' ? destId : null
    const finalAccId  = destType==='acc'  ? destId : null

    // Monta todas as transacoes em batch
    // Para transferencias: tenta encontrar par espelho ja existente no DB
    // (mesma data, mesmo valor, type=transferencia, accId diferente)
    // Se encontrar → vincula as duas contas automaticamente (toAccId <-> accId)
    const allTxs = [...db.transactions]
    const newTxs: Transaction[] = []
    const patchedExisting: Map<string, Transaction> = new Map()

    toImp.forEach(r => {
      if (r.type === 'transferencia') {
        // Busca par espelho: mesma data e valor, ja salvo em outra conta
        const mirror = allTxs.find(t =>
          t.type === 'transferencia' &&
          t.dateISO === r.dateISO &&
          Math.abs(t.val - r.val) < 0.02 &&
          t.accId !== finalAccId &&
          !t.toAccId // ainda nao vinculado
        )

        const dir = r.dir || 'out'
        if (mirror && finalAccId) {
          // Vincula o par — determina quem e origem e quem e destino pelo dir
          const mirrorDir = dir === 'out' ? 'in' : 'out'
          const linkedMirror = { ...mirror, toAccId: finalAccId, transferDir: mirrorDir }
          patchedExisting.set(mirror.id, linkedMirror)
          newTxs.push({
            id: genId(), name: r.name, cat: 'Transferência',
            type: 'transferencia' as const, val: r.val,
            dateISO: r.dateISO, date: isoToDisplay(r.dateISO),
            icon: '⇄', color: '#6b7591',
            accId: finalAccId, cardId: null,
            toAccId: dir === 'out' ? mirror.accId : null,
            transferDir: dir,
            invoiceMonth: null, invoiceYear: null,
          } as Transaction & { transferDir: string })
        } else {
          // Sem par — salva com dir para o computeBalance usar depois
          newTxs.push({
            id: genId(), name: r.name, cat: 'Transferência',
            type: 'transferencia' as const, val: r.val,
            dateISO: r.dateISO, date: isoToDisplay(r.dateISO),
            icon: '⇄', color: '#6b7591',
            accId: finalAccId, cardId: null, toAccId: null,
            transferDir: dir,
            invoiceMonth: null, invoiceYear: null,
          } as Transaction & { transferDir: string })
        }
      } else {
        newTxs.push({
          id: genId(), name: r.name, cat: r.cat, type: r.type as 'receita'|'despesa', val: r.val,
          dateISO: r.dateISO, date: isoToDisplay(r.dateISO),
          icon: r.icon || C_ICON[r.cat] || '💰',
          color: C_COLOR[r.cat] || '#6b7591',
          accId: finalCardId ? null : finalAccId,
          cardId: finalCardId,
          toAccId: null,
          invoiceMonth: finalCardId ? refMonth : null,
          invoiceYear:  finalCardId ? refYear  : null,
        })
      }
    })

    // Aplica patches nas transferencias existentes que foram vinculadas
    const updatedExisting = allTxs.map(t =>
      patchedExisting.has(t.id) ? patchedExisting.get(t.id)! : t
    )

    save({ ...db, transactions: [...newTxs, ...updatedExisting] })
    setImported(toImp.length); setStep(4)
  }

  const transferCount = pending.filter(r => r._sel && r.type === 'transferencia').length
  const recCount  = pending.filter(r => r._sel && r.type === 'receita').length
  const despCount = pending.filter(r => r._sel && r.type === 'despesa').length

  const stepStyle = (n: number) => ({
    width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:10, fontWeight:700, flexShrink:0,
    background: step>n ? 'var(--green)' : step===n ? 'var(--accent)' : 'var(--bg3)',
    border: `1px solid ${step>n ? 'var(--green)' : step===n ? 'var(--accent)' : 'var(--border)'}`,
    color: step>=n ? '#fff' : 'var(--muted)',
    boxShadow: step===n ? '0 0 8px rgba(99,102,241,.4)' : 'none'
  })

  const inputStyle = { background:'var(--bg3)', border:'1.5px solid var(--border)', borderRadius:'8px', padding:'8px 10px', fontFamily:'Sora,sans-serif', fontSize:'12px', color:'var(--text)', outline:'none', width:'100%' }

  const typeColor = (type: string) => type === 'receita' ? 'var(--green)' : type === 'transferencia' ? 'var(--muted)' : 'var(--red)'
  const typePrefix = (type: string) => type === 'receita' ? '+' : type === 'transferencia' ? '⇄' : '-'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,.75)', backdropFilter:'blur(8px)' }}
      onClick={e => { if(e.target===e.currentTarget) onClose() }}>
      <div className="w-full rounded-2xl p-6 overflow-y-auto" style={{ background:'var(--card2)', border:'1px solid var(--border)', maxWidth:720, maxHeight:'92vh', animation:'mdIn .2s ease' }}>

        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-base font-bold">📄 Importar Extrato / Fatura</div>
            <div className="text-xs mt-0.5" style={{color:'var(--muted)'}}>
              {presetAcc ? 'Conta: ' + presetAcc.name + ' · ' + MONTHS[refMonth] + ' ' + refYear : 'Print, imagem ou PDF — a IA extrai e você revisa'}
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer',padding:'2px 6px'}}>✕</button>
        </div>

        <div className="flex items-center my-5">
          {['Upload','Análise IA','Revisão','Concluído'].map((lbl,i) => (
            <div key={lbl} className="flex items-center" style={{flex: i<3?1:'auto'}}>
              <div className="flex items-center gap-2">
                <div style={stepStyle(i+1)}>{step>i+1?'✓':i+1}</div>
                <span className="text-xs font-semibold" style={{color:step===i+1?'var(--text)':'var(--muted)',whiteSpace:'nowrap'}}>{lbl}</span>
              </div>
              {i<3 && <div className="flex-1 h-px mx-2" style={{background:'var(--border)'}} />}
            </div>
          ))}
        </div>

        {step===1 && (
          <div>
            <div className="rounded-xl p-3.5 mb-3" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{color:'var(--muted)'}}>📅 Mês de referência</div>
              <div className="flex gap-2">
                <select value={refMonth} onChange={e=>setRefMonth(Number(e.target.value))}
                  style={{flex:1,background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:8,padding:'9px 12px',fontFamily:'Sora,sans-serif',fontSize:13,fontWeight:700,color:'var(--text)',outline:'none',cursor:'pointer'}}>
                  {MONTHS.map((m,i)=><option key={i} value={i}>{m}</option>)}
                </select>
                <select value={refYear} onChange={e=>setRefYear(Number(e.target.value))}
                  style={{width:100,background:'var(--bg)',border:'1.5px solid var(--border)',borderRadius:8,padding:'9px 12px',fontFamily:'Sora,sans-serif',fontSize:13,fontWeight:700,color:'var(--text)',outline:'none',cursor:'pointer'}}>
                  {[curYear-2,curYear-1,curYear,curYear+1].map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="text-xs mt-2" style={{color:'var(--muted)'}}>
                Lançamentos datados em <span style={{color:'var(--accent)',fontWeight:700}}>{MONTHS[refMonth]} {refYear}</span>
              </div>
            </div>

            <div className="relative rounded-xl p-8 text-center mb-3 transition-all"
              style={{border:'2px dashed var(--border)',cursor:'pointer'}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--accent)';(e.currentTarget as HTMLElement).style.background='var(--glow)'}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.background=''}}>
              <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" multiple onChange={handleFiles}
                style={{position:'absolute',inset:0,opacity:0,cursor:'pointer',width:'100%',height:'100%'}} />
              <div className="text-3xl mb-2">🖼️</div>
              <div className="text-sm font-bold mb-1">Arraste ou clique para selecionar</div>
              <div className="text-xs" style={{color:'var(--muted)'}}>PNG, JPG, WEBP, PDF — múltiplos arquivos</div>
            </div>

            {files.length>0 && (
              <div className="flex gap-2 flex-wrap mb-3">
                {files.map((f,i) => (
                  <div key={i} className="relative rounded-lg overflow-hidden" style={{width:64,height:64,border:'1px solid var(--border)'}}>
                    {f.type==='pdf'
                      ? <div className="w-full h-full flex flex-col items-center justify-center gap-1" style={{background:'rgba(239,68,68,.1)'}}>
                          <span style={{fontSize:20}}>📄</span>
                          <span className="text-center px-1" style={{fontSize:7,color:'var(--muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',width:'100%'}}>{f.name}</span>
                        </div>
                      : <img src={f.dataUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                    }
                    <button onClick={()=>removeFile(i)} style={{position:'absolute',top:2,right:2,width:14,height:14,borderRadius:'50%',background:'rgba(239,68,68,.9)',border:'none',color:'#fff',fontSize:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl p-3.5 mb-4" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
              <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{color:'var(--muted)'}}>📌 Vincular ao</div>
              {presetAcc ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{background:'var(--glow)',border:'1.5px solid var(--accent)',display:'inline-flex'}}>
                  <span style={{fontSize:14}}>🏦</span>
                  <span className="text-xs font-bold" style={{color:'var(--accent)'}}>{presetAcc.name}</span>
                  <span className="text-xs" style={{color:'var(--muted)'}}>· pré-selecionado</span>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {[{type:'none' as const,id:'',label:'📋 Sem vínculo'},...db.cards.map(c=>({type:'card' as const,id:c.id,label:'💳 '+c.name})),...db.accounts.filter(a=>!a.archived).map(a=>({type:'acc' as const,id:a.id,label:'🏦 '+a.name}))].map(opt=>{
                    const isActive = destType===opt.type && destId===opt.id
                    return (
                      <button key={opt.type+opt.id} onClick={()=>{setDestType(opt.type);setDestId(opt.id)}}
                        style={{padding:'6px 12px',borderRadius:8,border:'1.5px solid '+(isActive?'var(--accent)':'var(--border)'),background:isActive?'var(--glow)':'var(--bg)',color:isActive?'var(--accent)':'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:11,fontWeight:600,cursor:'pointer'}}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={onClose} style={{padding:'10px 20px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>Cancelar</button>
              <button onClick={runAI} disabled={!files.length}
                style={{padding:'10px 20px',background:files.length?'linear-gradient(135deg,var(--accent),var(--accent2))':'var(--bg3)',border:'none',borderRadius:'9px',color:files.length?'#fff':'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:files.length?'pointer':'not-allowed'}}>
                ✨ Analisar com IA
              </button>
            </div>
          </div>
        )}

        {step===2 && (
          <div className="py-8">
            <div className="rounded-xl p-5" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
              <div className="flex items-center gap-2 mb-3">
                <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'linear-gradient(135deg,rgba(99,102,241,.18),rgba(6,182,212,.18))',border:'1px solid rgba(99,102,241,.28)',borderRadius:20,padding:'3px 10px',fontSize:9,fontWeight:700,color:'var(--cyan)'}}>
                  {[0,1,2].map(i=><span key={i} style={{width:6,height:6,borderRadius:'50%',background:'var(--accent)',animationDelay:`${i*.2}s`,display:'inline-block'}} />)}
                  &nbsp;IA Analisando
                </span>
              </div>
              <div className="text-sm font-bold mb-1">{aiMsg}</div>
              <div className="text-xs mb-3" style={{color:'var(--muted)'}}>{aiSub}</div>
              <div className="h-1 rounded-full overflow-hidden mb-1" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
                <div className="h-full rounded-full transition-all" style={{width:prog+'%',background:'linear-gradient(90deg,var(--accent),var(--cyan))'}} />
              </div>
              <div className="text-xs text-right" style={{color:'var(--muted)'}}>{Math.round(prog)}%</div>
            </div>
          </div>
        )}

        {step===3 && (
          <div>
            <div className="flex gap-3 p-3 rounded-xl mb-3" style={{background:'var(--bg3)',border:'1px solid var(--border)'}}>
              {[
                {label:'Receitas',value:recCount,color:'var(--green)'},
                {label:'Despesas',value:despCount,color:'var(--red)'},
                {label:'Transf.',value:transferCount,color:'var(--muted)'},
                {label:'Total R$',value:fmt(pending.filter(r=>r._sel && r.type!=='transferencia').reduce((s,r)=>s+(r.type==='receita'?r.val:-r.val),0)),color:'var(--cyan)'},
              ].map(k=>(
                <div key={k.label} className="flex-1 text-center">
                  <div className="font-mono text-lg font-extrabold" style={{color:k.color}}>{k.value}</div>
                  <div className="text-xs uppercase tracking-wide" style={{color:'var(--muted)',fontSize:9}}>{k.label}</div>
                </div>
              ))}
            </div>

            {transferCount > 0 && (
              <div className="rounded-lg px-3 py-2 mb-3 text-xs" style={{background:'rgba(99,102,241,.08)',border:'1px solid rgba(99,102,241,.2)',color:'var(--muted)'}}>
                ⇄ <strong style={{color:'var(--accent)'}}>{transferCount} transferência{transferCount!==1?'s':''}</strong> identificada{transferCount!==1?'s':''} — não entram no balanço de receitas/despesas
              </div>
            )}

            <div className="flex items-center justify-between mb-2">
              <div className="text-xs" style={{color:'var(--muted)'}}>✏️ Clique para editar · <span style={{color:'var(--muted)'}}>⇄ = transferência</span></div>
              <div className="flex gap-1">
                <button onClick={()=>setPending(p=>p.map(r=>({...r,_sel:true})))} style={{fontSize:10,padding:'3px 8px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:5,color:'var(--muted)',cursor:'pointer',fontFamily:'Sora,sans-serif'}}>Todos</button>
                <button onClick={()=>setPending(p=>p.map(r=>({...r,_sel:false})))} style={{fontSize:10,padding:'3px 8px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:5,color:'var(--muted)',cursor:'pointer',fontFamily:'Sora,sans-serif'}}>Nenhum</button>
              </div>
            </div>

            <div className="rounded-xl overflow-hidden mb-4" style={{border:'1px solid var(--border)',maxHeight:340,overflowY:'auto'}}>
              <div className="grid gap-1 px-3 py-2 text-xs font-bold uppercase tracking-wide" style={{gridTemplateColumns:'24px 1fr 90px 80px 55px 75px',color:'var(--muted)',borderBottom:'1px solid var(--border)',background:'var(--bg3)'}}>
                <div/><div>Descrição</div><div>Categoria</div><div>Tipo</div><div>Data</div><div>Valor</div>
              </div>
              {pending.map((r,i) => (
                <div key={r._id} className="grid gap-1 px-3 py-2 items-center transition-colors"
                  style={{gridTemplateColumns:'24px 1fr 90px 80px 55px 75px',borderBottom:'1px solid var(--border)',background:r.type==='transferencia'?'rgba(99,102,241,.04)':r._dup?'rgba(239,68,68,.04)':r._sel?'':'rgba(0,0,0,.15)',opacity:r._sel?1:.5}}>
                  <div onClick={()=>setPending(p=>p.map((x,j)=>j===i?{...x,_sel:!x._sel}:x))}
                    style={{width:17,height:17,borderRadius:4,border:'1px solid var(--border)',background:r._sel?'var(--accent)':'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,cursor:'pointer',color:'#fff'}}>
                    {r._sel?'✓':''}
                  </div>
                  <input value={r.name} onChange={e=>setPending(p=>p.map((x,j)=>j===i?{...x,name:e.target.value}:x))} style={{...inputStyle,padding:'4px 6px',fontSize:11}} />
                  {r.type === 'transferencia' ? (
                    <div style={{fontSize:10,color:'var(--muted)',fontWeight:700,textAlign:'center'}}>⇄ Transf.</div>
                  ) : (
                    <select value={r.cat} onChange={e=>setPending(p=>p.map((x,j)=>j===i?{...x,cat:e.target.value}:x))} style={{...inputStyle,padding:'3px 4px',fontSize:10}}>
                      {CATS.map(c=><option key={c}>{c}</option>)}
                    </select>
                  )}
                  <select value={r.type} onChange={e=>setPending(p=>p.map((x,j)=>j===i?{...x,type:e.target.value as 'receita'|'despesa'|'transferencia'}:x))}
                    style={{...inputStyle,padding:'3px 4px',fontSize:10,color:typeColor(r.type)}}>
                    <option value="despesa">↓ Despesa</option>
                    <option value="receita">↑ Receita</option>
                    <option value="transferencia">⇄ Transf.</option>
                  </select>
                  <input value={r.date} onChange={e=>setPending(p=>p.map((x,j)=>j===i?{...x,date:e.target.value}:x))} style={{...inputStyle,padding:'3px 4px',fontSize:10}} />
                  <div style={{fontFamily:'JetBrains Mono,monospace',fontSize:11,fontWeight:700,color:typeColor(r.type)}}>
                    {typePrefix(r.type)} {fmt(r.val)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={()=>setStep(1)} style={{padding:'10px 20px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>← Voltar</button>
              <button onClick={doImport} style={{padding:'10px 24px',background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                Importar {pending.filter(r=>r._sel).length} lançamento{pending.filter(r=>r._sel).length!==1?'s':''}
              </button>
            </div>
          </div>
        )}

        {step===4 && (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">✅</div>
            <div className="text-lg font-extrabold mb-2">{imported} lançamento{imported!==1?'s':''} importado{imported!==1?'s':''}!</div>
            <div className="text-xs mb-6" style={{color:'var(--muted)'}}>Salvos e sincronizados na nuvem.</div>
            <div className="flex gap-3 justify-center">
              <button onClick={()=>{setStep(1);setFiles([]);setPending([])}} style={{padding:'10px 20px',background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'9px',color:'var(--muted)',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:600,cursor:'pointer'}}>
                📷 Importar mais
              </button>
              <button onClick={onClose} style={{padding:'10px 20px',background:'linear-gradient(135deg,var(--accent),var(--accent2))',border:'none',borderRadius:'9px',color:'#fff',fontFamily:'Sora,sans-serif',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                Ver Transações
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
