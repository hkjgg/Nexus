import {
  Bot,
  FlaskConical,
  Gauge,
  Map,
  Package,
  TrendingUp,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One line describing what the section will do, shown on its stub page. */
  summary: string;
  /** False until the section is built; the sidebar marks it and the page
   *  explains what is coming. */
  ready: boolean;
};

/**
 * The eight destinations of the product, in the order an operator moves
 * through them: what is happening now, where, what was ordered, who is
 * carrying it, what they are carrying it in, what it all adds up to, what
 * would happen if something changed, and finally the analyst to ask.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/',
    label: 'Command Center',
    icon: Gauge,
    summary: 'The whole operation on one screen.',
    ready: true,
  },
  {
    href: '/live-map',
    label: 'Live Map',
    icon: Map,
    summary: 'Every driver, order and zone on the city, updating as it happens.',
    ready: false,
  },
  {
    href: '/orders',
    label: 'Orders',
    icon: Package,
    summary: 'Every order, its lifecycle and the events behind each status change.',
    ready: false,
  },
  {
    href: '/drivers',
    label: 'Drivers',
    icon: Users,
    summary: 'Roster, shifts, load and performance for each driver.',
    ready: false,
  },
  {
    href: '/fleet',
    label: 'Fleet',
    icon: Truck,
    summary: 'Vehicles, fuel burn, maintenance and cost per kilometre.',
    ready: false,
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: TrendingUp,
    summary: 'Trends, cohorts and unit economics across any range.',
    ready: false,
  },
  {
    href: '/simulator',
    label: 'Simulator',
    icon: FlaskConical,
    summary: 'Change the operation on paper and see the numbers move before you commit.',
    ready: false,
  },
  {
    href: '/assistant',
    label: 'AI Assistant',
    icon: Bot,
    summary: 'Ask the operation a question in plain language and get an answer with its workings.',
    ready: false,
  },
];
