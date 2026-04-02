import { createHash } from 'node:crypto'
import { constants, createReadStream } from 'node:fs'
import { access, open, readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

export type BackupFormat = 'gzip' | 'plain-sql' | 'postgres-custom'

export interface BackupVerificationEnvironment {
  backupFile: string
  checksumFile: string | null
  maxAgeHours: number
  minimumBytes: number
}

export interface BackupVerificationSummary {
  ageHours: number
  backupFile: string
  checksumVerified: boolean
  detectedFormat: BackupFormat
  modifiedAt: string
  sizeBytes: number
  status: 'ok'
}

const gzipMagicByte1 = 0x1f
const gzipMagicByte2 = 0x8b
const postgresCustomHeader = 'PGDMP'

/**
 * 解析正数配置，避免备份校验接受负值或零值。
 */
function parsePositiveNumber(
  rawValue: string | undefined,
  fallbackValue: number,
  label: string,
): number {
  if (!rawValue?.trim()) {
    return fallbackValue
  }

  const parsedValue = Number.parseFloat(rawValue)

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} must be a positive number`)
  }

  return parsedValue
}

/**
 * 解析备份校验脚本运行环境。
 */
export function resolveBackupVerificationEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): BackupVerificationEnvironment {
  const backupFile = environment.BACKUP_FILE?.trim()

  if (!backupFile) {
    throw new Error('BACKUP_FILE is required for backup verification')
  }

  return {
    backupFile: resolve(backupFile),
    checksumFile: environment.CHECKSUM_FILE?.trim()
      ? resolve(environment.CHECKSUM_FILE.trim())
      : null,
    maxAgeHours: parsePositiveNumber(environment.BACKUP_MAX_AGE_HOURS, 24, 'BACKUP_MAX_AGE_HOURS'),
    minimumBytes: parsePositiveNumber(
      environment.BACKUP_MINIMUM_BYTES,
      1024,
      'BACKUP_MINIMUM_BYTES',
    ),
  }
}

/**
 * 确认目标文件可读。
 */
async function ensureReadableFile(filePath: string): Promise<void> {
  await access(filePath, constants.R_OK)
}

/**
 * 读取备份文件头部样本，用于格式判定而不把整个文件加载进内存。
 */
async function readBackupSample(filePath: string, sampleBytes: number = 8192): Promise<Buffer> {
  const fileHandle = await open(filePath, 'r')

  try {
    const buffer = Buffer.alloc(sampleBytes)
    const { bytesRead } = await fileHandle.read(buffer, 0, sampleBytes, 0)

    return buffer.subarray(0, bytesRead)
  } finally {
    await fileHandle.close()
  }
}

/**
 * 根据扩展名与文件头识别备份格式。
 */
export function detectBackupFormat(filePath: string, sample: Buffer): BackupFormat {
  if (sample[0] === gzipMagicByte1 && sample[1] === gzipMagicByte2 && sample.byteLength >= 2) {
    return 'gzip'
  }

  if (sample.subarray(0, postgresCustomHeader.length).toString('utf8') === postgresCustomHeader) {
    return 'postgres-custom'
  }

  const extension = extname(filePath).toLowerCase()
  const sampleText = sample.toString('utf8')

  if (
    extension === '.sql' ||
    /-- PostgreSQL database dump|CREATE TABLE|INSERT INTO|COPY\s+\S+\s+\(/.test(sampleText)
  ) {
    return 'plain-sql'
  }

  throw new Error(`Unsupported or unrecognized backup format for ${filePath}`)
}

/**
 * 计算备份文件 SHA-256，用于和外部校验文件比对。
 */
async function hashFileSha256(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  const stream = createReadStream(filePath)

  for await (const chunk of stream) {
    hash.update(chunk)
  }

  return hash.digest('hex')
}

/**
 * 读取 checksum 文件中的预期 SHA-256 值。
 */
async function readExpectedChecksum(checksumFile: string): Promise<string> {
  const checksumSource = await readFile(checksumFile, 'utf8')
  const matchedChecksum = checksumSource.match(/\b[a-f0-9]{64}\b/i)?.[0]

  if (!matchedChecksum) {
    throw new Error(`Checksum file ${checksumFile} does not contain a SHA-256 value`)
  }

  return matchedChecksum.toLowerCase()
}

/**
 * 执行备份文件完整性与时效性校验。
 */
export async function verifyBackupArtifact(
  environment: BackupVerificationEnvironment = resolveBackupVerificationEnvironment(),
): Promise<BackupVerificationSummary> {
  await ensureReadableFile(environment.backupFile)

  if (environment.checksumFile) {
    await ensureReadableFile(environment.checksumFile)
  }

  const backupStats = await stat(environment.backupFile)

  if (backupStats.size < environment.minimumBytes) {
    throw new Error(
      `Backup file ${environment.backupFile} is smaller than ${environment.minimumBytes} bytes`,
    )
  }

  const ageHours = (Date.now() - backupStats.mtimeMs) / (1000 * 60 * 60)

  if (ageHours > environment.maxAgeHours) {
    throw new Error(
      `Backup file ${environment.backupFile} is older than ${environment.maxAgeHours} hours`,
    )
  }

  const backupSample = await readBackupSample(environment.backupFile)
  const detectedFormat = detectBackupFormat(environment.backupFile, backupSample)

  if (environment.checksumFile) {
    const [actualChecksum, expectedChecksum] = await Promise.all([
      hashFileSha256(environment.backupFile),
      readExpectedChecksum(environment.checksumFile),
    ])

    if (actualChecksum !== expectedChecksum) {
      throw new Error(`Checksum mismatch for backup file ${environment.backupFile}`)
    }
  }

  return {
    ageHours: Number.parseFloat(ageHours.toFixed(2)),
    backupFile: environment.backupFile,
    checksumVerified: Boolean(environment.checksumFile),
    detectedFormat,
    modifiedAt: backupStats.mtime.toISOString(),
    sizeBytes: backupStats.size,
    status: 'ok',
  }
}
