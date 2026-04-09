import { randomBytes, scrypt } from 'node:crypto'

const betterAuthPasswordConfig = {
  N: 16_384,
  dkLen: 64,
  p: 1,
  r: 16,
} as const

/**
 * 生成与 Better Auth credential provider 兼容的口令哈希格式。
 *
 * 兼容约束：
 * - 保持 `salt:key` 结构
 * - 继续使用 Better Auth 当前的 scrypt 参数
 * - salt 作为十六进制字符串参与 KDF，和上游实现保持一致
 */
export async function hashCredentialPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const normalizedPassword = password.normalize('NFKC')
  const key = await new Promise<Buffer>((resolve, reject) => {
    scrypt(
      normalizedPassword,
      salt,
      betterAuthPasswordConfig.dkLen,
      {
        N: betterAuthPasswordConfig.N,
        maxmem: 128 * betterAuthPasswordConfig.N * betterAuthPasswordConfig.r * 2,
        p: betterAuthPasswordConfig.p,
        r: betterAuthPasswordConfig.r,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }

        resolve(Buffer.from(derivedKey))
      },
    )
  })

  return `${salt}:${key.toString('hex')}`
}
