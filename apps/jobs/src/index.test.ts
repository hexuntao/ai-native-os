import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import test from 'node:test'
import { semanticSearchKnowledgeBase } from '@ai-native-os/api/mastra/rag/retrieval'
import { listAiAuditLogsByToolId } from '@ai-native-os/db'
import { executeRagIndexingTask, ragIndexingTask } from './trigger/rag-indexing'
import { executeReportScheduleTask, reportScheduleTask } from './trigger/report-schedule'

test('scheduled report task executes the workflow and writes task-level audit logs', async () => {
  const result = await executeReportScheduleTask({
    reportLabel: 'jobs-smoke-report',
    triggerSource: 'test',
  })
  const taskLogs = await listAiAuditLogsByToolId('task:report-schedule-trigger')

  assert.equal(result.taskId, 'report-schedule-trigger')
  assert.equal(result.workflow.reportLabel, 'jobs-smoke-report')
  assert.equal(result.workflow.triggerSource, 'test')
  assert.ok(
    taskLogs.some(
      (log: (typeof taskLogs)[number]) =>
        log.requestInfo?.requestId === result.workflow.requestId && log.status === 'success',
    ),
  )
  assert.equal(reportScheduleTask.id, 'report-schedule-trigger')
})

test('rag indexing task indexes a sample document and makes it searchable', async () => {
  const documentId = randomUUID()
  const title = `RAG smoke ${randomUUID().slice(0, 8)}`
  const result = await executeRagIndexingTask({
    chunkOverlap: 48,
    chunkSize: 220,
    content: `
财务报表知识库

季度营收分析显示企业订阅收入增长明显，核心原因是自动化续费转化率提升。
如果需要查询营收增长的原因，应优先关注订阅收入、续费率和大客户扩容。
`,
    documentId,
    metadata: {
      domain: 'finance',
    },
    sourceType: 'manual',
    sourceUri: 'https://example.com/rag-finance',
    title,
  })
  const retrieval = await semanticSearchKnowledgeBase({
    documentId,
    limit: 3,
    query: '查询订阅收入增长的原因',
  })
  const taskLogs = await listAiAuditLogsByToolId('task:rag-indexing')

  assert.equal(result.taskId, 'rag-indexing')
  assert.equal(result.documentId, documentId)
  assert.ok(result.chunkCount > 0)
  assert.equal(ragIndexingTask.id, 'rag-indexing')
  assert.equal(retrieval.matches[0]?.documentId, documentId)
  assert.equal(retrieval.matches[0]?.title, title)
  assert.ok(retrieval.matches[0]?.content.includes('订阅收入'))
  assert.ok(
    taskLogs.some(
      (log: (typeof taskLogs)[number]) =>
        log.input !== null &&
        typeof log.input === 'object' &&
        'documentId' in log.input &&
        (log.input as { documentId?: string }).documentId === documentId &&
        log.status === 'success',
    ),
  )
})
