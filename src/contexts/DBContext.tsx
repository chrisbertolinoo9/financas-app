import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAuth } from './AuthContext'
import { loadLocal, loadCloud, saveLocal, saveCloud, emptyDB } from '../lib/db'
import { genId, isoToDisplay } from '../lib/utils'
import type { DB, Transaction, Account, Card, PlanGoal } from '../types'

// Calcula saldo dinamico de uma conta.
//
// Cada transferencia gera 2 registros no DB:
//   - lado SAIDA: accId=origem, toAccId=destino  → subtrai do saldo da origem
//   - lado ENTRADA: accId=destino, toAccId=origem → soma no saldo do destino
//
// Quando ainda nao vinculada (toAccId=null), o extrato bancario ja diz:
//   - se veio como "entrada" no extrato → soma (ex: Nubank recebeu da Dai)
//   - se veio como "saida" no extrato → subtrai (ex: Nubank enviou para 99)
//
// transferDir='in' soma, 'out' subtrai.
// Transferencias sem transferDir sao ignoradas no calculo (nao afetam saldo).
// Apenas transferencias criadas manualmente com toAccId afetam os dois lados.
export function computeBalance(accId: string, initialBalance: number, transactions: Transaction[]): number {
  return transactions
    .filter(t => t.accId === accId)
    .reduce((sum, t) => {
      if (t.type === 'receita') return sum + t.val
      if (t.type === 'despesa') return sum - t.val
      // transferencia: so conta se tiver transferDir explicito
      const dir = (t as Transaction & { transferDir?: string }).transferDir
      if (dir === 'in')  return sum + t.val
      if (dir === 'out') return sum - t.val
      // sem transferDir → ignora (nao afeta saldo)
      return sum
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
      ...(({ transferDir: 'out' }) as object),
    }
    const entrada: Transaction = {
      id: genId(), name: label, cat: 'Transferência',
      type: 'transferencia', val, dateISO: date,
      date: isoToDisplay(date), icon: '⇄',
      color: '#6b7591', accId: toAccId, cardId: null, toAccId: fromAccId,
      ...(({ transferDir: 'in' }) as object),
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
