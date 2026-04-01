import { reportScheduleEvalSuite } from './report-schedule'
import type { MastraEvalSuite } from './types'

const mastraEvalSuites = [reportScheduleEvalSuite] as const satisfies readonly MastraEvalSuite[]

export const mastraEvalSuiteRegistry = mastraEvalSuites

/**
 * 统一导出评估套件注册表，避免路由、任务和 runner 分别维护一份配置。
 */
export function listMastraEvalSuites(): readonly MastraEvalSuite[] {
  return mastraEvalSuites
}

export function getMastraEvalSuiteById(id: string): MastraEvalSuite | null {
  return mastraEvalSuites.find((suite) => suite.id === id) ?? null
}

export function getMastraEvalScorerRegistry() {
  return Object.fromEntries(
    mastraEvalSuites.flatMap((suite) =>
      suite.scorers.map((scorer) => [scorer.id, scorer] as const),
    ),
  )
}
