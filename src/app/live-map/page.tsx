import { ComingNext } from '@/components/shell';

export const metadata = { title: 'Live Map - NEXUS' };

export default function Page() {
  return (
    <ComingNext
      href="/live-map"
      groundwork={[
        'Zone polygons and driver positions already render on the Command Center mini-map.',
        'Realtime is enabled on orders, drivers and alerts in the database.',
      ]}
    />
  );
}
