import { useState, useEffect } from 'react'
import { DBProvider } from '../contexts/DBContext'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import Topbar from './Topbar'
import Dashboard from './Dashboard'
import Contas from './Contas'
import Transacoes from './Transacoes'
import Cartoes from './Cartoes'
import Planejamento from './Planejamento'
import Relatorios from './Relatorios'

export type View = 'dashboard' | 'contas' | 'transacoes' | 'cartoes' | 'planejamento' | 'relatorios'

const VIEW_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  contas: 'Contas',
  transacoes: 'Transações',
  cartoes: 'Cartões de Crédito',
  planejamento: 'Planejamento',
  relatorios: 'Relatórios',
}

export default function MainApp() {
  const [view, setView] = useState<View>('dashboard')
  const [curMonth, setCurMonth] = useState(new Date().getMonth())
  const [curYear, setCurYear] = useState(new Date().getFullYear())

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  const changeMonth = (dir: number) => {
    let m = curMonth + dir
    let y = curYear
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setCurMonth(m)
    setCurYear(y)
  }

  return (
    <DBProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
        <Sidebar view={view} setView={setView} />
        <div className="flex flex-col flex-1 overflow-hidden" style={{ marginLeft: 232 }}>
          <Topbar
            title={VIEW_TITLES[view]}
            monthLabel={MONTHS[curMonth] + ' ' + curYear}
            onPrevMonth={() => changeMonth(-1)}
            onNextMonth={() => changeMonth(1)}
          />
          <main className="flex-1 overflow-y-auto p-6 pb-20 md:pb-6">
            {view === 'dashboard'    && <Dashboard curMonth={curMonth} curYear={curYear} />}
            {view === 'contas'       && <Contas />}
            {view === 'transacoes'   && <Transacoes curMonth={curMonth} curYear={curYear} />}
            {view === 'cartoes'      && <Cartoes curMonth={curMonth} curYear={curYear} />}
            {view === 'planejamento' && <Planejamento curMonth={curMonth} curYear={curYear} />}
            {view === 'relatorios'   && <Relatorios curMonth={curMonth} curYear={curYear} />}
          </main>
        </div>
        <MobileNav view={view} setView={setView} />
      </div>
    </DBProvider>
  )
}
