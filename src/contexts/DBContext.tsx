import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext'
import { loadLocal, loadCloud, saveLocal, saveCloud, emptyDB } from '../lib/db'
import { genId, isoToDisplay, C_ICON, C_COLOR } from '../lib/utils'
import type { DB, Transaction, Account, Card, PlanGoal } from '../types'

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

  const addAccount        = (a: Account)     => save({ ...db, accounts: [...db.accounts, a] })
  const updateAccount     = (a: Account)     => save({ ...db, accounts: db.accounts.map(x => x.id===a.id ? a : x) })
  const deleteAccount     = (id: string)     => save({ ...db, accounts: db.accounts.filter(x => x.id!==id), transactions: db.transactions.filter(x => x.accId!==id) })
  const addCard           = (c: Card)        => save({ ...db, cards: [...db.cards, c] })
  const updateCard        = (c: Card)        => save({ ...db, cards: db.cards.map(x => x.id===c.id ? c : x) })
  const deleteCard        = (id: string)     => save({ ...db, cards: db.cards.filter(x => x.id!==id), transactions: db.transactions.filter(x => x.cardId!==id) })
  const upsertPlanGoal    = (g: PlanGoal)    => {
    const goals = db.planGoals.findIndex(x => x.cat===g.cat) >= 0
      ? db.planGoals.map(x => x.cat===g.cat ? g : x)
      : [...db.planGoals, g]
    save({ ...db, planGoals: goals })
  }
  const clearAll = () => save({ ...emptyDB })

  return (
    <DBContext.Provider value={{ db, ready, save, addTransaction, updateTransaction, deleteTransaction, addTransfer, addAccount, updateAccount, deleteAccount, addCard, updateCard, deleteCard, upsertPlanGoal, clearAll }}>
      {children}
    </DBContext.Provider>
  )
}

export function useDB() { return useContext(DBContext) }
