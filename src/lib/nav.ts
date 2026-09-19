/**
 * The product's navigation.
 *
 * Week 1 ships the Command Center. The other seven destinations are real
 * routes with a stated plan rather than dead links, so the shape of the
 * product is legible from the first screen.
 */

import {
  BarChart3,
  Gauge,
  Map,
  Package,
  Sparkles,
  SlidersHorizontal,
  Truck,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** False until the section is built; renders the "Coming next" state. */
  ready: boolean;
  /** One line describing what the section will do, shown on its placeholder. */
  summary: string;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/',
    label: 'Command Center',
    icon: Gauge,
    ready: true,
    summary: 'Headline KPIs, zone performance and live alerts for the whole operation.',
  },
  {
    href: '/live-map',
    label: 'Live Map',
    icon: Map,
    ready: false,
    summary: 'Full-screen map of drivers, active orders and zone load, updating in real time.',
  },
  {
    href: '/orders',
    label: 'Orders',
    icon: Package,
    ready: false,
    summary: 'Every order with its lifecycle trail, searchable and filterable by zone and status.',
  },
  {
    href: '/drivers',
    label: 'Drivers',
    icon: Users,
    ready: false,
    summary: 'Roster, shift history and per-driver delivery performance.',
  },
  {
    href: '/fleet',
    label: 'Fleet',
    icon: Truck,
    ready: false,
    summary: 'Vehicles, fuel and maintenance spend, and cost per kilometre by vehicle.',
  },
  {
    href: '/analytics',
    label: 'Analytics',
    icon: BarChart3,
    ready: false,
    summary: 'Deeper trends, cohort and channel breakdowns, and margin analysis.',
  },
  {
    href: '/simulator',
    label: 'Simulator',
    icon: SlidersHorizontal,
    ready: false,
    summary: 'Ask what a change would do: add a driver to a zone, reprice a route, shift a shift.',
  },
  {
    href: '/ai-assistant',
    label: 'AI Assistant',
    icon: Sparkles,
    ready: false,
    summary: 'Ask questions about the operation in plain language, answered from the same data.',
  },
];

export const navItemByHref = (href: string): NavItem | undefined =>
  NAV_ITEMS.find((item) => item.href === href);
