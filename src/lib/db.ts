import { doc, setDoc, getDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { DB } from '../types'

const STORE_KEY = 'fp_db_v3'

export const emptyDB: DB = {
  transactions: [],
  accounts: [],
  cards: [],
  planGoals: [],
}

export function saveLocal(data: DB) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data))
}

export function loadLocal(): DB {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return { ...emptyDB }
    const parsed = JSON.parse(raw) as DB
    if (!Array.isArray(parsed.transactions)) return { ...emptyDB }
    return {
      transactions: parsed.transactions || [],
      accounts: parsed.accounts || [],
      cards: parsed.cards || [],
      planGoals: parsed.planGoals || [],
    }
  } catch {
    return { ...emptyDB }
  }
}

export async function saveCloud(uid: string, data: DB) {
  try {
    await setDoc(doc(db, 'users', uid), {
      db: JSON.stringify(data),
      updatedAt: Date.now(),
    })
  } catch (e) {
    console.warn('Cloud sync error:', e)
  }
}

export async function loadCloud(uid: string): Promise<DB | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists() && snap.data().db) {
      const parsed = JSON.parse(snap.data().db) as DB
      return {
        transactions: parsed.transactions || [],
        accounts: parsed.accounts || [],
        cards: parsed.cards || [],
        planGoals: parsed.planGoals || [],
      }
    }
    return null
  } catch (e) {
    console.warn('Load cloud error:', e)
    return null
  }
}
