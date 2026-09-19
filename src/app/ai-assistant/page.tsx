import { ComingNext } from '@/components/shell';

export const metadata = { title: 'AI Assistant - NEXUS' };

export default function Page() {
  return (
    <ComingNext
      href="/ai-assistant"
      groundwork={[
        'The KPI layer exposes typed, single-metric accessors an agent can call.',
        'Alert rules already explain themselves in plain language.',
      ]}
    />
  );
}
