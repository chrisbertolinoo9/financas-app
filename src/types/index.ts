export interface Transaction {
  id: string
  name: string
  cat: string
  type: 'receita' | 'despesa' | 'transferencia'
  val: number
  date: string
  dateISO: string
  icon: string
  color: string
  accId: string | null
  cardId: string | null
  toAccId?: string | null
  parcelado?: boolean
  totalParcelas?: number | null
  parcelaAtual?: number | null
  invoiceMonth?: number | null
  invoiceYear?: number | null
}

export interface Account {
  id: string
  name: string
  type: 'corrente' | 'poupanca' | 'investimento' | 'carteira' | 'outro'
  balance: number
  initialBalance: number
  color: string
  archived?: boolean
  includeInTotal?: boolean
}

export interface Card {
  id: string
  name: string
  brand: string
  type: 'credito' | 'prepago' | 'debito'
  limit: number
  balance: number
  due: number
  color: string
  cashback?: number
}

export interface PlanGoal {
  id: string
  cat: string
  amount: number
}

export interface DB {
  transactions: Transaction[]
  accounts: Account[]
  cards: Card[]
  planGoals: PlanGoal[]
}
