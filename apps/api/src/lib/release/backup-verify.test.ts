import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  detectBackupFormat,
  resolveBackupVerificationEnvironment,
  verifyBackupArtifact,
} from './backup-verify'

/**
 * 生成临时测试目录，避免备份校验测试污染仓库。
 */
async function createTemporaryDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'ai-native-os-backup-'))
}

/**
 * 为测试备份生成 SHA-256 checksum 文件。
 */
async function writeChecksumFile(backupFile: string, checksumFile: string): Promise<void> {
  const backupBuffer = await readFile(backupFile)
  const checksum = createHash('sha256').update(backupBuffer).digest('hex')

  await writeFile(checksumFile, `${checksum}  ${backupFile}\n`, 'utf8')
}

test('resolveBackupVerificationEnvironment requires BACKUP_FILE', () => {
  assert.throws(() => resolveBackupVerificationEnvironment({}), /BACKUP_FILE is required/)
})

test('detectBackupFormat recognizes PostgreSQL custom dumps and SQL dumps', () => {
  assert.equal(detectBackupFormat('backup.dump', Buffer.from('PGDMP-test')), 'postgres-custom')
  assert.equal(
    detectBackupFormat('backup.sql', Buffer.from('-- PostgreSQL database dump\nCREATE TABLE x();')),
    'plain-sql',
  )
  assert.equal(detectBackupFormat('backup.sql.gz', Buffer.from([0x1f, 0x8b, 0x08, 0x00])), 'gzip')
})

test('verifyBackupArtifact validates a recent SQL dump with checksum', async () => {
  const temporaryDirectory = await createTemporaryDirectory()
  const backupFile = join(temporaryDirectory, 'ai-native-os.sql')
  const checksumFile = join(temporaryDirectory, 'ai-native-os.sql.sha256')

  try {
    await writeFile(
      backupFile,
      '-- PostgreSQL database dump\nCREATE TABLE accounts(id uuid primary key);\n'.repeat(64),
      'utf8',
    )
    await writeChecksumFile(backupFile, checksumFile)

    const summary = await verifyBackupArtifact({
      backupFile,
      checksumFile,
      maxAgeHours: 24,
      minimumBytes: 128,
    })

    assert.equal(summary.status, 'ok')
    assert.equal(summary.detectedFormat, 'plain-sql')
    assert.equal(summary.checksumVerified, true)
    assert.ok(summary.sizeBytes >= 128)
  } finally {
    await rm(temporaryDirectory, {
      force: true,
      recursive: true,
    })
  }
})

test('verifyBackupArtifact rejects stale backups', async () => {
  const temporaryDirectory = await createTemporaryDirectory()
  const backupFile = join(temporaryDirectory, 'ai-native-os.dump')

  try {
    await writeFile(backupFile, Buffer.from(`PGDMP${'x'.repeat(2048)}`))

    const staleDate = new Date('2026-03-25T00:00:00.000Z')
    await utimes(backupFile, staleDate, staleDate)

    await assert.rejects(
      verifyBackupArtifact({
        backupFile,
        checksumFile: null,
        maxAgeHours: 24,
        minimumBytes: 128,
      }),
      /older than 24 hours/,
    )
  } finally {
    await rm(temporaryDirectory, {
      force: true,
      recursive: true,
    })
  }
})
