'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type * as React from 'react'
import { AssistantPanel } from '@/components/copilot/assistant-panel'
import { Badge } from '@/components/ui/badge'
import {
  Infobar,
  InfobarContent,
  InfobarGroup,
  InfobarGroupContent,
  InfobarHeader,
  InfobarRail,
  InfobarTrigger,
  useInfobar,
} from '@/components/ui/infobar'
import { resolveAssistantRailContent } from '@/lib/copilot'
import { useShellContext } from './shell-provider'

function flattenInfobarLinks(content: InfobarContent | null): { href: string; label: string }[] {
  if (!content) {
    return []
  }

  return content.sections.flatMap((section) =>
    (section.links ?? []).map((link) => ({
      href: link.url,
      label: link.title,
    })),
  )
}

function resolveInfobarSummary(content: InfobarContent | null): string | null {
  return content?.sections[0]?.description ?? null
}

export function InfoSidebar({ ...props }: React.ComponentProps<typeof Infobar>) {
  const pathname = usePathname()
  const { content } = useInfobar()
  const { initialBridgeSummary, shellState } = useShellContext()
  const railContent = resolveAssistantRailContent(pathname, shellState, initialBridgeSummary, {
    links: flattenInfobarLinks(content),
    summary: resolveInfobarSummary(content),
    title: content?.title ?? null,
  })

  return (
    <Infobar {...props}>
      <InfobarHeader className="bg-sidebar sticky top-0 z-10 flex flex-row items-start justify-between gap-2 border-b px-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-muted-foreground text-[11px] tracking-[0.18em] uppercase">
            Assistant rail
          </p>
          <h2 className="mt-1 text-lg font-semibold break-words">{railContent.title}</h2>
        </div>
        <div className="shrink-0">
          <InfobarTrigger className="-mr-1" />
        </div>
      </InfobarHeader>
      <InfobarContent>
        <InfobarGroup>
          <InfobarGroupContent>
            <div className="flex flex-col gap-4 px-4 py-4">
              <section className="rounded-lg border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-1">
                    <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">
                      Current object
                    </p>
                    <p className="text-sm font-semibold">{railContent.title}</p>
                  </div>
                  <Badge variant="outline">{pathname}</Badge>
                </div>
                <p className="text-muted-foreground mt-3 text-sm leading-6">
                  {railContent.summary}
                </p>
                <div className="mt-4 grid gap-2">
                  {railContent.facts.map((fact) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-md border bg-background/70 px-3 py-2 text-sm"
                      key={fact.label}
                    >
                      <span className="text-muted-foreground">{fact.label}</span>
                      <span className="text-right font-medium">{fact.value}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Guardrail & next step</p>
                  <Badge
                    variant={
                      railContent.assistantState.status === 'ready'
                        ? 'default'
                        : railContent.assistantState.status === 'error'
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {railContent.assistantState.status}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-3 text-sm leading-6">
                  {railContent.guardrail}
                </p>
                <p className="text-muted-foreground mt-3 text-sm leading-6">
                  {railContent.assistantState.detail}
                </p>
                {railContent.links.length > 0 ? (
                  <div className="mt-4 grid gap-2">
                    <p className="text-muted-foreground text-[11px] tracking-[0.16em] uppercase">
                      Recommended links
                    </p>
                    {railContent.links.map((link) => (
                      <Link
                        className="text-primary text-sm underline underline-offset-4"
                        href={link.href as Route}
                        key={`${link.href}:${link.label}`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </section>

              <AssistantPanel initialBridgeSummary={initialBridgeSummary} shellState={shellState} />
            </div>
          </InfobarGroupContent>
        </InfobarGroup>
      </InfobarContent>
      <InfobarRail />
    </Infobar>
  )
}
