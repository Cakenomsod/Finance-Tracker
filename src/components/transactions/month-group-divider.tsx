import { TableCell, TableRow } from '@/components/ui/table'

export function MonthGroupDividerRow({
  label,
  colSpan,
}: {
  label: string
  colSpan: number
}) {
  return (
    <TableRow className="bg-muted/50 hover:bg-muted/50">
      <TableCell colSpan={colSpan} className="px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-sm font-bold tracking-wide text-foreground">
            {label}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </TableCell>
    </TableRow>
  )
}

export function MonthGroupDividerMobile({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <span className="shrink-0 text-sm font-bold text-foreground">{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
