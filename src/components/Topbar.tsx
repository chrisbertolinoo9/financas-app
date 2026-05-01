interface Props {
  title: string
  monthLabel: string
  onPrevMonth: () => void
  onNextMonth: () => void
}
export default function Topbar({ title, monthLabel, onPrevMonth, onNextMonth }: Props) {
  return (
    <header className="flex items-center gap-3 px-6 py-3 flex-shrink-0 sticky top-0 z-40" style={{ background: 'rgba(11,14,24,.9)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex-1 text-base font-bold">{title}</div>
      <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <span className="cursor-pointer px-1" style={{ color: 'var(--muted)' }} onClick={onPrevMonth}>‹</span>
        <span>{monthLabel}</span>
        <span className="cursor-pointer px-1" style={{ color: 'var(--muted)' }} onClick={onNextMonth}>›</span>
      </div>
      <div className="w-8 h-8 flex items-center justify-center rounded-lg text-sm relative" style={{ background: 'var(--card)', border: '1px solid var(--border)', cursor: 'pointer' }}>
        🔔
        <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--red)', border: '2px solid var(--bg)' }} />
      </div>
    </header>
  )
}
