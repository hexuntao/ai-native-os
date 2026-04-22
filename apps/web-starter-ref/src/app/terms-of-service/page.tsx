import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '服务条款',
  robots: {
    index: false,
  },
}

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Main Heading */}
        <div className="text-center">
          <h1 className="text-foreground text-3xl font-bold">服务条款</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            最后更新：
            {new Date().toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Introduction */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">简介</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            欢迎使用本应用。这些服务条款约束你对平台的访问与使用。只要你访问或使用本应用，即表示你同意受这些条款约束。请在继续使用前仔细阅读。
          </p>
        </section>

        {/* Demo Purpose */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">演示用途</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            本应用仅用于演示与教学目的，并非面向生产环境。我们不保证它适用于任何特定用途。所有数据与功能都按“现状”提供，仅用于展示能力和特性。
          </p>
        </section>

        {/* Open Source */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">开源说明</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            这是一个开源项目。源码可在适用的开源许可证下被审阅、修改和分发。我们欢迎社区贡献和反馈，以帮助项目持续改进。许可证详情和贡献指南请参阅项目仓库。
          </p>
        </section>

        {/* No Warranty */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">免责说明</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            本应用按“现状”提供，不附带任何形式的明示或暗示担保。我们明确声明不承担任何担保责任，包括但不限于适销性、特定用途适用性和不侵权担保。我们也不保证应用始终不中断、及时、安全或无错误。
          </p>
        </section>

        {/* Data Usage */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">数据使用</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            你在使用本演示应用时提供的任何数据，都可能仅为展示功能而被临时存储。我们不保证输入到本演示应用中的数据具备生产级的安全性或隐私保护。请不要输入敏感、个人或机密信息。数据可能随时被删除或重置，恕不另行通知。
          </p>
        </section>

        {/* Changes */}
        <section>
          <h2 className="text-foreground mb-3 text-xl font-semibold">条款变更</h2>
          <p className="text-muted-foreground text-base leading-relaxed">
            我们保留随时自行修改或替换这些服务条款的权利。你有责任定期查看这些条款是否有变化。在条款变更发布后继续使用本应用，即视为你接受这些变更。
          </p>
        </section>

        {/* Contact */}
        <section className="border-border border-t pt-4">
          <p className="text-muted-foreground text-center text-sm">
            如果你对这些服务条款有任何疑问，请查阅项目文档或代码仓库获取更多信息。
          </p>
        </section>
      </div>
    </div>
  )
}
