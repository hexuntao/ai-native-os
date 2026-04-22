import type { Route } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ReadBoundaryLink {
  href: string
  label: string
}

interface ReadBoundaryCardProps {
  description: string
  links?: readonly ReadBoundaryLink[]
  nextStep: string
  reason: string
  title: string
}

export function ReadBoundaryCard({
  description,
  links,
  nextStep,
  reason,
  title,
}: ReadBoundaryCardProps): ReactNode {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{description}</CardDescription>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground mb-2 text-xs tracking-[0.16em] uppercase">
            Why blocked
          </p>
          <p className="text-sm leading-7">{reason}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground mb-2 text-xs tracking-[0.16em] uppercase">
            What is still visible
          </p>
          <p className="text-sm leading-7">{nextStep}</p>
        </div>
        {links && links.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {links.map((link) => (
              <Button asChild key={`${link.href}:${link.label}`} size="sm" variant="outline">
                <Link href={link.href as Route}>{link.label}</Link>
              </Button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
