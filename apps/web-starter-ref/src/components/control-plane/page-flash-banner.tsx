import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

interface PageFlashBannerProps {
  kind: 'error' | 'success'
  message: string
}

export function PageFlashBanner({ kind, message }: PageFlashBannerProps): ReactNode {
  return (
    <Alert variant={kind === 'error' ? 'destructive' : 'default'}>
      <AlertTitle>{kind === 'error' ? 'Request failed' : 'Saved'}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
