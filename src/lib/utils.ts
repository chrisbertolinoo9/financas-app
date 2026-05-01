import type { Transaction, Card } from '../types'

export const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

export const C_ICON: Record<string,string> = {
  Alimentação:'🛒',Moradia:'🏠',Transporte:'🚗',Saúde:'💊',Lazer:'🎮',
  Salário:'💼',Freelance:'🎨',Investimentos:'📈','Renda Extra':'💵',
  Outros:'📌',Assinatura:'📱',Educação:'📚',Vestuário:'👕',Combustível:'⛽',Restaurante:'🍽️'
}

export const C_COLOR: Record<string,string> = {
  Alimentação:'#f59e0b',Moradia:'#ef4444',Transporte:'#3b82f6',Saúde:'#8b5cf6',
  Lazer:'#06b6d4',Salário:'#22c55e',Freelance:'#22c55e','Renda Extra':'#22c55e',
  Investimentos:'#22c55e',Outros:'#6b7591',Assinatura:'#6366f1',Educação:'#f59e0b',
  Vestuário:'#f59e0b',Combustível:'#3b82f6',Restaurante:'#f59e0b'
}

export function fmt(v: number): string {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function isoToDisplay(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function inMonth(dateISO: string, month: number, year: number): boolean {
  if (!dateISO) return false
  const d = new Date(dateISO + 'T12:00:00')
  return d.getMonth() === month && d.getFullYear() === year
}

export function txBelongsToInvoice(t: Transaction, card: Card, month: number, year: number): boolean {
  if (!t.dateISO) return false
  if (t.invoiceMonth !== null && t.invoiceMonth !== undefined &&
      t.invoiceYear !== null && t.invoiceYear !== undefined) {
    return t.invoiceMonth === month && t.invoiceYear === year
  }
  const d = new Date(t.dateISO + 'T12:00:00')
  const tMonth = d.getMonth(), tYear = d.getFullYear(), tDay = d.getDate()
  const due = card.due || 1
  if (tMonth === month && tYear === year) return true
  let prevMonth = month - 1, prevYear = year
  if (prevMonth < 0) { prevMonth = 11; prevYear-- }
  if (tMonth === prevMonth && tYear === prevYear && tDay > due) return true
  return false
}

export function genId(): string {
  return 'id' + Date.now() + Math.random().toString(36).slice(2, 7)
}

// Retorna true se a transação ocorreu ATÉ (inclusive) o fim do mês/ano
export function upToMonth(dateISO: string, month: number, year: number): boolean {
  if (!dateISO) return false
  const d = new Date(dateISO + 'T12:00:00')
  if (d.getFullYear() < year) return true
  if (d.getFullYear() === year && d.getMonth() <= month) return true
  return false
}
