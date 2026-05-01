import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { loadLocal, loadCloud, saveLocal, saveCloud, emptyDB } from '../lib/db'
import { genId, isoToDisplay, C_ICON, C_COLOR } from '../lib/utils'
import type { DB, Transaction, Account, Card, PlanGoal } from '../types'

// Calcula saldo dinamico de uma conta:
// initialBalance + receitas + transferencias recebidas - despesas - transferencias enviadas
export function computeBalance(accId: string, initialBalance: number, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.accId === accId)
    .reduce((sum, t) => {
      if (t.type === 'receita') return sum + t.val
      if (t.type === 'despesa') return sum - t.val
      // transferencia: se toAccId aponta para outra conta, saiu daqui → subtrai
      // se accId === esta conta e veio de outra (toAccId é a origem), entrou aqui → soma
      // A logica e: o registro com accId=esta_conta sempre representa o lado desta conta
      // Quando a Dai manda para o Nubank:
      //   - registro 1: accId=Dai, toAccId=Nubank → saída da Dai
      //   - registro 2: accId=Nubank, toAccId=Dai → entrada no Nubank
      // Precisamos saber se este registro e a saida ou a entrada
      // Se toAccId existe e e diferente: verificamos se ha outro registro espelho
      // Simplificacao: transferencia com accId=esta_conta e toAccId=outra → SAIDA
      // transferencia com accId=esta_conta e toAccId=outra onde o par espelho existe → ENTRADA
      // Na importacao do extrato Nubank, transferencias recebidas tem accId=Nubank e sao entradas
      // transferencias enviadas tem accId=Nubank e sao saidas
      // Para diferenciar: usamos o campo que a IA ja classifica como entrada/saida
      // Mas como o type e sempre 'transferencia', usamos toAccId:
      // se toAccId != null → saiu desta conta para outra → SUBTRAI
      // se toAccId == null → chegou de fora (importada como entrada) → SOMA
      if (t.toAccId) return sum - t.val  // saida: enviou para outra conta
      return sum + t.val                  // entrada: recebeu de outra conta
    }, initialBalance)
}

interface DBContextType {
  db: DB
  ready: boolean
  save: (newDB: DB) => void
  addTransaction: (t: Transaction) => void
  updateTransaction: (t: Transaction) => void
  deleteTransaction: (id: string) => void
  addTransfer: (fromAccId: string, toAccId: string, val: number, date: string, desc: string) => void
  addAccount: (a: Account) => void
  updateAccount: (a: Account) => void
  deleteAccount: (id: string) => void
  addCard: (c: Card) => void
  updateCard: (c: Card) => void
  deleteCard: (id: string) => void
  upsertPlanGoal: (g: PlanGoal) => void
  clearAll: () => void
  // Mapa de saldos dinamicos calculados: accId -> balance
  balances: Record<string, number>
}

const DBContext = createContext<DBContextType>({} as DBContextType)

export function DBProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [db, setDB] = useState<DB>(() => loadLocal())
  const [ready, setReady] = useState(false)
  const syncTimer = useRef<ReturnType<typeof setTimeout>|null>(null)

  useEffect(() => {
    if (user) {
      loadCloud(user.uid).then(cloud => {
        if (cloud) {
          setDB(cloud)
          saveLocal(cloud)
        }
        setReady(true)
      })
    } else {
      setDB(loadLocal())
      setReady(true)
    }
  }, [user])

  const save = useCallback((newDB: DB) => {
    setDB(newDB)
    saveLocal(newDB)
    if (user) {
      if (syncTimer.current) clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(() => saveCloud(user.uid, newDB), 2000)
    }
  }, [user])

  // Saldos dinamicos — recalculados sempre que transacoes ou contas mudam
  const balances = useMemo(() => {
    const map: Record<string, number> = {}
    db.accounts.forEach(a => {
      map[a.id] = computeBalance(a.id, a.initialBalance || 0, db.transactions)
    })
    return map
  }, [db.accounts, db.transactions])

  const addTransaction    = (t: Transaction) => save({ ...db, transactions: [t, ...db.transactions] })
  const updateTransaction = (t: Transaction) => save({ ...db, transactions: db.transactions.map(x => x.id===t.id ? t : x) })
  const deleteTransaction = (id: string)     => save({ ...db, transactions: db.transactions.filter(x => x.id!==id) })

  const addTransfer = (fromAccId: string, toAccId: string, val: number, date: string, desc: string) => {
    const label = desc || 'Transferência'
    const saida: Transaction = {
      id: genId(), name: label, cat: 'Transferência',
      type: 'transferencia', val, dateISO: date,
      date: isoToDisplay(date), icon: '⇄',
      color: '#6b7591', accId: fromAccId, cardId: null, toAccId,
    }
    const entrada: Transaction = {
      id: genId(), name: label, cat: 'Transferência',
      type: 'transferencia', val, dateISO: date,
      date: isoToDisplay(date), icon: '⇄',
      color: '#6b7591', accId: toAccId, cardId: null, toAccId: fromAccId,
    }
    save({ ...db, transactions: [saida, entrada, ...db.transactions] })
  }

  const addAccount     = (a: Account) => save({ ...db, accounts: [...db.accounts, a] })
  const updateAccount  = (a: Account) => save({ ...db, accounts: db.accounts.map(x => x.id===a.id ? a : x) })
  const deleteAccount  = (id: string) => save({ ...db, accounts: db.accounts.filter(x => x.id!==id), transactions: db.transactions.filter(x => x.accId!==id) })
  const addCard        = (c: Card)    => save({ ...db, cards: [...db.cards, c] })
  const updateCard     = (c: Card)    => save({ ...db, cards: db.cards.map(x => x.id===c.id ? c : x) })
  const deleteCard     = (id: string) => save({ ...db, cards: db.cards.filter(x => x.id!==id), transactions: db.transactions.filter(x => x.cardId!==id) })
  const upsertPlanGoal = (g: PlanGoal) => {
    const goals = db.planGoals.findIndex(x => x.cat===g.cat) >= 0
      ? db.planGoals.map(x => x.cat===g.cat ? g : x)
      : [...db.planGoals, g]
    save({ ...db, planGoals: goals })
  }
  const clearAll = () => save({ ...emptyDB })

  return (
    <DBContext.Provider value={{ db, ready, save, addTransaction, updateTransaction, deleteTransaction, addTransfer, addAccount, updateAccount, deleteAccount, addCard, updateCard, deleteCard, upsertPlanGoal, clearAll, balances }}>
      {children}
    </DBContext.Provider>
  )
}

export function useDB() { return useContext(DBContext) }
