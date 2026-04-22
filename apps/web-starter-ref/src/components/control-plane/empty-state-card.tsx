import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface EmptyStateAction {
  href: string
  label: string
}

interface EmptyStateCardProps {
  action?: EmptyStateAction
  description: string
  title: string
  tone: 'no-data' | 'no-match'
}

function resolveDescription(tone: EmptyStateCardProps['tone']): string {
  if (tone === 'no-match') {
    return '当前筛选没有匹配结果'
  }

  return '当前还没有可见记录'
}

export function EmptyStateCard({
  action,
  description,
  title,
  tone,
}: EmptyStateCardProps): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{resolveDescription(tone)}</CardDescription>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-muted-foreground text-sm leading-7">{description}</p>
        {action ? (
          <div>
            <Button asChild variant="outline">
              <Link href={action.href as Route}>{action.label}</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
