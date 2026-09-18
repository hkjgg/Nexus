import { ComingNext } from '@/components/shell';

export const metadata = { title: 'Orders - NEXUS' };

export default function Page() {
  return (
    <ComingNext
      href="/orders"
      groundwork={[
        '55,000+ orders with a full status-transition trail are already seeded.',
        'Order status, channel and cancellation reasons are modelled in the schema.',
      ]}
    />
  );
}
