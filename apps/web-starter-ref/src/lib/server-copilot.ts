import type { CopilotBridgeSummary } from '@ai-native-os/shared'
import { cookies } from 'next/headers'
import { fetchCopilotBridgeSummary } from '@/lib/api'
import { resolveWebEnvironment } from '@/lib/env'

export async function loadCurrentCopilotBridgeSummary(): Promise<CopilotBridgeSummary | null> {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString() || undefined

  return fetchCopilotBridgeSummary(cookieHeader, resolveWebEnvironment())
}
