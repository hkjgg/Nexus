import { ComingNext } from '@/components/shell';

export const metadata = { title: 'Drivers - NEXUS' };

export default function Page() {
  return (
    <ComingNext
      href="/drivers"
      groundwork={[
        'Forty drivers with shifts, home zones and vehicles are already seeded.',
        'Per-driver load feeds the overloaded-driver alert on the Command Center.',
      ]}
    />
  );
}
