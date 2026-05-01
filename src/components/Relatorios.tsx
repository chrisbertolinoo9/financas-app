import { useMemo, useState, useCallback } from 'react'
import { useDB } from '../contexts/DBContext'
import { fmt, inMonth, C_COLOR } from '../lib/utils'

interface Props { curMonth: number; curYear: number }

const PROXY = 'https://financas-proxy.chrisbertolinoo9.workers.dev/v1/messages'
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export default function Relatorios({ curMonth, curYear }: Props) {
  const { db } = useDB()
  const [aiStudy, setAiStudy] = useState<string>('')
  const [aiLoading, setAiLoading] = useState(false)

  const txs = useMemo(() => db.transactions.filter(t => inMonth(t.dateISO, curMonth, curYear)), [db.transactions, curMonth, curYear])
  const txsReal = useMemo(() => txs.filter(t => t.type !== 'transferencia'), [txs])
  const rec  = useMemo(() => txsReal.filter(t => t.type==='receita').reduce((s,t) => s+t.val, 0), [txsReal])
  const desp = useMemo(() => txsReal.filter(t => t.type==='despesa').reduce((s,t) => s+t.val, 0), [txsReal])

  const catTotals = useMemo(() => {
    const m: Record<string,number> = {}
    txsReal.filter(t => t.type==='despesa').forEach(t => { m[t.cat] = (m[t.cat]||0)+t.val })
    return Object.entries(m).sort((a,b) => b[1]-a[1]).slice(0,6)
  }, [txsReal])

  const maxV = catTotals[0]?.[1] || 1

  const runAiStudy = useCallback(async () => {
    setAiLoading(true)
    setAiStudy('')
    try {
      const despesas = txsReal.filter(t => t.type==='despesa')
      const receitas = txsReal.filter(t => t.type==='receita')
      const catMap: Record<string,number> = {}
      despesas.forEach(t => { catMap[t.cat] = (catMap[t.cat]||0)+t.val })
      const catRanking = Object.entries(catMap).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>`${cat}: R$${val.toFixed(2)}`).join(', ')
      const topDespesas = despesas.sort((a,b)=>b.val-a.val).slice(0,10).map(t=>`${t.name} (${t.cat}): R$${t.val.toFixed(2)}`).join(' | ')
      const topReceitas = receitas.sort((a,b)=>b.val-a.val).slice(0,5).map(t=>`${t.name}: R$${t.val.toFixed(2)}`).join(' | ')
      const taxaPoupanca = rec > 0 ? Math.round((rec-desp)/rec*100) : 0

      const prompt = `Você é um consultor financeiro pessoal analisando os dados de ${MONTHS[curMonth]} ${curYear}.

DADOS DO MÊS (excluindo transferências entre contas):
- Receitas totais: R$${rec.toFixed(2)}
- Despesas totais: R$${desp.toFixed(2)}
- Balanço: R$${(rec-desp).toFixed(2)}
- Taxa de poupança: ${taxaPoupanca}%
- Total de transações reais: ${txsReal.length}

DESPESAS POR CATEGORIA:
${catRanking}

TOP 10 MAIORES DESPESAS:
${topDespesas}

TOP RECEITAS:
${topReceitas}

Faça um estudo financeiro completo e direto em português brasileiro. Estruture assim:

📊 RESUMO DO MÊS
[2-3 frases sobre o panorama geral]

🔴 PONTOS DE ATENÇÃO
[Liste 2-3 gastos ou padrões preocupantes com valores específicos]

✅ PONTOS POSITIVOS
[Liste 1-2 aspectos positivos]

💡 RECOMENDAÇÕES
[Liste 3 ações concretas e específicas para o próximo mês]

Seja direto, use os valores reais, sem rodeios.`

      const resp = await fetch(PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-opus-4-5',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      })
      const data = await resp.json()
      if (data.error) throw new Error(data.error.message)
      const text = data.content.map((b: {text?:string}) => b.text||'').join('')
      setAiStudy(text)
    } catch(e) {
      setAiStudy('Erro ao gerar estudo: ' + String(e))
    } finally {
      setAiLoading(false)
    }
  }, [txsReal, rec, desp, curMonth, curYear])

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
              <span className="font-mono text-xs font-bold">{txsReal.length}</span>
            </div>
            <div className="flex justify-between px-3 py-2.5 rounded-lg" style={{ background:'var(--bg3)' }}>
              <span className="text-xs" style={{ color:'var(--muted)' }}>Ticket médio despesas</span>
              <span className="font-mono text-xs font-bold" style={{ color:'var(--red)' }}>
                R$ {fmt(txsReal.filter(t=>t.type==='despesa').length ? desp/txsReal.filter(t=>t.type==='despesa').length : 0)}
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

      {/* Estudo IA */}
      <div className="rounded-2xl p-5" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-bold">🤖 Estudo Financeiro IA</div>
            <div className="text-xs mt-0.5" style={{ color:'var(--muted)' }}>
              Análise de {MONTHS[curMonth]} {curYear} · excluindo transferências entre contas
            </div>
          </div>
          <button onClick={runAiStudy} disabled={aiLoading}
            style={{
              padding:'9px 18px',
              background: aiLoading ? 'var(--bg3)' : 'linear-gradient(135deg,var(--accent),var(--accent2))',
              border:'none', borderRadius:'9px',
              color: aiLoading ? 'var(--muted)' : '#fff',
              fontFamily:'Sora,sans-serif', fontSize:'12px', fontWeight:700,
              cursor: aiLoading ? 'not-allowed' : 'pointer',
              display:'flex', alignItems:'center', gap:6, flexShrink:0
            }}>
            {aiLoading ? (
              <>
                <span style={{display:'inline-block',width:10,height:10,borderRadius:'50%',border:'2px solid var(--muted)',borderTopColor:'var(--accent)',animation:'spin 0.8s linear infinite'}} />
                Analisando...
              </>
            ) : '✨ Gerar Estudo'}
          </button>
        </div>

        {!aiStudy && !aiLoading && (
          <div className="rounded-xl p-6 text-center" style={{ background:'var(--bg3)', border:'1px dashed var(--border)' }}>
            <div className="text-2xl mb-2">🧠</div>
            <div className="text-sm font-semibold mb-1">Análise inteligente do seu mês</div>
            <div className="text-xs" style={{ color:'var(--muted)' }}>
              Clique em "Gerar Estudo" para receber uma análise completa com pontos de atenção e recomendações personalizadas
            </div>
          </div>
        )}

        {aiLoading && (
          <div className="rounded-xl p-6 text-center" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
            <div className="text-2xl mb-3">⏳</div>
            <div className="text-sm font-semibold mb-1">Analisando seus dados financeiros...</div>
            <div className="text-xs" style={{ color:'var(--muted)' }}>Isso leva alguns segundos</div>
          </div>
        )}

        {aiStudy && !aiLoading && (
          <div className="rounded-xl p-4" style={{ background:'var(--bg3)', border:'1px solid var(--border)' }}>
            <div style={{ whiteSpace:'pre-wrap', fontSize:'13px', lineHeight:'1.75', color:'var(--text)', fontFamily:'Sora,sans-serif' }}>
              {aiStudy}
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={()=>setAiStudy('')}
                style={{ padding:'6px 14px', background:'none', border:'1px solid var(--border)', borderRadius:7, color:'var(--muted)', fontFamily:'Sora,sans-serif', fontSize:11, cursor:'pointer' }}>
                Limpar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
