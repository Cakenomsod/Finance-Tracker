import { TableCell, TableRow } from '@/components/ui/table'

export function DateGroupDividerMobile({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 bg-muted/30 px-4 py-2">
      <span className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}

export function DateGroupDividerRow({
  label,
  colSpan,
}: {
  label: string
  colSpan: number
}) {
  return (
    <TableRow className="bg-muted/30 hover:bg-muted/30">
      <TableCell colSpan={colSpan} className="px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="shrink-0 text-xs font-semibold tracking-wide text-muted-foreground">
            {label}
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </TableCell>
    </TableRow>
  )
}
