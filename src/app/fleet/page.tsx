import { ComingNext } from '@/components/shell';

export const metadata = { title: 'Fleet - NEXUS' };

export default function Page() {
  return (
    <ComingNext
      href="/fleet"
      groundwork={[
        'Thirty-four vehicles with fuel, maintenance and fixed costs are seeded.',
        'Fuel burn per kilometre already drives the vehicle anomaly alert.',
      ]}
    />
  );
}
