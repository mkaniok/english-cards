export default function Tile({ icon, value, label }: { icon: string; value: string | number; label: string }) {
  return (
    <div className="panel !p-4 text-center">
      <div className="text-2xl">{icon}</div>
      <div className="text-3xl font-black text-violet-700 dark:text-violet-300">{value}</div>
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  )
}
