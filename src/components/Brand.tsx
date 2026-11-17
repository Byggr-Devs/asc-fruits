export function BrandMark({ className = 'size-9' }: { className?: string }) {
  return <img src="/favicon.svg" alt="" className={`${className} rounded-[10px]`} />
}

export function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <BrandMark />
      {!collapsed && (
        <span className="font-brand text-lg font-bold tracking-wide text-primary-ink">ASC Fruits</span>
      )}
    </div>
  )
}
