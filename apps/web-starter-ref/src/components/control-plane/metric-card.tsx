import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface MetricCardProps {
  badge?: string
  detail: string
  label: string
  value: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary'
}

export function MetricCard({
  badge,
  detail,
  label,
  value,
  variant = 'outline',
}: MetricCardProps): React.ReactNode {
  return (
    <Card className="@container/card">
      <CardHeader className="gap-3">
        <CardDescription>{label}</CardDescription>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {value}
          </CardTitle>
          {badge ? <Badge variant={variant}>{badge}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="text-muted-foreground text-sm leading-6">{detail}</CardContent>
    </Card>
  )
}
