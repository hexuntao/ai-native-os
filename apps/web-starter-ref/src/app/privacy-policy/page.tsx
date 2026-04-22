import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '隐私政策',
  robots: {
    index: false,
  },
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Main Heading */}
        <h1 className="text-foreground text-3xl font-bold">隐私政策</h1>

        {/* Introduction */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">简介</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            本隐私政策说明当你使用本应用时，我们如何处理你的个人信息。我们致力于保护你的隐私，并确保我们的数据实践保持透明。请仔细阅读本政策，以了解我们如何收集、使用和保护你的信息。
          </p>
        </section>

        {/* Data Collection */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">数据收集</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            本应用仅收集完成认证所必需的最少数据。当你通过认证服务登录时，我们会接收邮箱、姓名等基础资料。这些数据仅用于在应用内识别你的身份，并为你提供个性化的功能访问权限。
          </p>
        </section>

        {/* Auth handled by Clerk */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">认证说明</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            本应用使用{' '}
            <a
              href="https://clerk.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline"
            >
              Clerk
            </a>{' '}
            安全地处理用户认证。包括注册、登录和密码管理在内的所有认证流程，都由 Clerk
            负责。若要了解 Clerk 如何处理和保护你的数据，请查阅其{' '}
            <a
              href="https://clerk.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline"
            >
              隐私政策
            </a>
            .
          </p>
        </section>

        {/* No data misuse */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">不会滥用数据</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            我们严肃对待你的隐私。你的个人数据不会被出售、出租，也不会为了营销或商业目的与第三方共享。你的信息仅用于本应用的既定功能，不会被滥用或以其他方式利用。
          </p>
        </section>

        {/* Demo purpose */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">演示应用</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            请注意，这是一款用于演示与教学的示例应用。它用于展示不同功能与技术实现，不应被视为生产就绪服务。你提供的任何数据都可能只是临时保存，并可能在常规维护中被删除。
          </p>
        </section>

        {/* Contact */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">联系我们</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            如果你对本隐私政策或我们的数据处理方式有任何问题、疑虑或请求，欢迎通过以下方式联系我们：{' '}
            <a
              href="mailto:contact@kiranism.dev"
              className="text-primary font-medium hover:underline"
            >
              contact@kiranism.dev
            </a>
            。
          </p>
        </section>

        {/* Last Updated */}
        <div className="border-border border-t pt-4">
          <p className="text-muted-foreground text-sm">最后更新：2026 年 2 月</p>
        </div>
      </div>
    </div>
  )
}
