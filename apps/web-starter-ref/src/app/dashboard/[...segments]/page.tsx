import PageContainer from '@/components/layout/page-container';
import type { InfobarContent } from '@/components/ui/infobar';
import type { ReactNode } from 'react';

interface PlaceholderPageProps {
  params: Promise<{
    segments: string[];
  }>;
}

function formatTitle(segments: readonly string[]): string {
  return segments
    .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
    .join(' / ');
}

export default async function PlaceholderPage({
  params
}: PlaceholderPageProps): Promise<ReactNode> {
  const { segments } = await params;
  const title = formatTitle(segments);

  const infoContent: InfobarContent = {
    title,
    sections: [
      {
        title: 'Migration target',
        description:
          'This route has been reserved in the new starter-based shell. The detailed AI-native workflow will be ported here in the next migration slice.'
      }
    ]
  };

  return (
    <PageContainer
      pageTitle={title}
      pageDescription='Starter-derived placeholder that marks the next migration target.'
      infoContent={infoContent}
    >
      <div className='rounded-lg border p-6'>
        <p className='text-muted-foreground text-sm leading-7'>
          This route is intentionally minimal for now. The shell, authentication boundary, and
          AI-native navigation are already active; the detailed workbench content will be migrated
          here next.
        </p>
      </div>
    </PageContainer>
  );
}
