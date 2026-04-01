import type { ReactNode } from 'react'

interface PlaceholderPageProps {
  eyebrow: string
  summary: string
  title: string
}

export function PlaceholderPage({ eyebrow, summary, title }: PlaceholderPageProps): ReactNode {
  return (
    <article>
      <p className="section-kicker">{eyebrow}</p>
      <h2 className="page-title">{title}</h2>
      <p className="page-lede">{summary}</p>
    </article>
  )
}
