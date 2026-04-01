import type { ToolAction, ToolExecutionContext } from '@mastra/core/tools'

import { mastraTools as registeredMastraTools } from './tools'

export const mastraAgents = {}

export const mastraTools = registeredMastraTools as Record<
  string,
  ToolAction<
    unknown,
    unknown,
    unknown,
    unknown,
    ToolExecutionContext<unknown, unknown, unknown>,
    string,
    unknown
  >
>

export const mastraWorkflows = {}
