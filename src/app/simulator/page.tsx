import { ComingNext } from '@/components/shell';

export const metadata = { title: 'Simulator - NEXUS' };

export default function Page() {
  return (
    <ComingNext
      href="/simulator"
      groundwork={[
        'The demand, cost and duration model lives in src/lib/sim and is reproducible.',
        'Every constant the simulation uses is declared in one config file.',
      ]}
    />
  );
}
