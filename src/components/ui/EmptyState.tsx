import { type LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-cream-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-brand-700" />
      </div>
      <h3 className="font-display font-semibold text-slate-900 text-lg mb-1">{title}</h3>
      {description && <p className="text-slate-600 text-sm max-w-xs mb-6">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  )
}
