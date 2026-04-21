import type { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  pageDescription?: string
  pageHeaderAction?: ReactNode
  pageTitle?: string
}

export default function PageContainer({
  children,
  pageDescription,
  pageHeaderAction,
  pageTitle,
}: PageContainerProps): ReactNode {
  return (
    <div className="flex flex-1 flex-col p-4 md:px-6">
      {pageTitle ? (
        <div className="bg-background sticky top-0 z-10 mb-4 flex items-start justify-between gap-4 pb-4">
          <div className="grid gap-2">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Dashboard
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground">{pageTitle}</h1>
            {pageDescription ? (
              <p className="max-w-3xl text-sm leading-7 text-muted-foreground">{pageDescription}</p>
            ) : null}
          </div>
          {pageHeaderAction ? <div className="shrink-0">{pageHeaderAction}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}
