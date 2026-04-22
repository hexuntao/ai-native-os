import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '关于',
}

export default function AboutPage() {
  return (
    <div className="min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">关于</h1>
          <p className="text-muted-foreground mt-4 text-lg">了解这个项目的更多信息</p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          {/* Open Source Section */}
          <section className="bg-card rounded-2xl border p-8 shadow-sm">
            <h2 className="text-foreground mb-4 text-xl font-semibold">开源项目</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              这是一个基于现代 Web 技术构建的开源 Next.js 管理后台
              Starter。它为构建强大的管理界面和仪表盘提供了扎实基础，源码可自由使用、修改和分发。
            </p>
          </section>

          {/* Demo Purpose Section */}
          <section className="bg-card rounded-2xl border p-8 shadow-sm">
            <h2 className="text-foreground mb-4 text-xl font-semibold">演示用途</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              这个应用主要用于演示，展示后台 Starter
              的特性、组件与能力。你可以自由浏览界面、测试功能，并评估它是否适合你的项目需求。
            </p>
          </section>

          {/* Auth Section */}
          <section className="bg-card rounded-2xl border p-8 shadow-sm">
            <h2 className="text-foreground mb-4 text-xl font-semibold">认证说明</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              这个应用当前的认证逻辑由{' '}
              <a
                href="https://clerk.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline"
              >
                Clerk
              </a>
              负责，它提供安全登录、会话管理与用户数据保护能力。
            </p>
          </section>

          {/* Data Privacy Section */}
          <section className="bg-card rounded-2xl border p-8 shadow-sm">
            <h2 className="text-foreground mb-4 text-xl font-semibold">数据隐私</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              我们严肃对待你的隐私。不会滥用、分享或出售你的个人数据。演示应用中采集的信息仅用于提供演示体验，并按数据保护最佳实践处理。
            </p>
          </section>
        </div>

        {/* Footer Note */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-sm">
            使用 Next.js、Tailwind CSS 与 shadcn/ui 构建
          </p>
        </div>
      </div>
    </div>
  )
}
