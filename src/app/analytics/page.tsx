import { ComingNext } from '@/components/shell';

export const metadata = { title: 'Analytics - NEXUS' };

export default function Page() {
  return (
    <ComingNext
      href="/analytics"
      groundwork={[
        'The deterministic KPI layer computes every metric in SQL.',
        'A per-zone, per-day view (v_zone_daily) is already in the database.',
      ]}
    />
  );
}
