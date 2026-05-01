export default function Relatorios({ curMonth, curYear }: { curMonth: number; curYear: number }) {
  return (
    <div className="flex items-center justify-center h-64 flex-col gap-4">
      <div className="text-5xl">↗</div>
      <div className="text-lg font-bold">Relatorios</div>
      <div className="text-sm" style={{ color: "var(--muted)" }}>Em breve — migrando do HTML original</div>
    </div>
  )
}
