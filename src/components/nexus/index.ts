/**
 * The NEXUS component library.
 *
 * Everything the product UI is built from lives behind this one import, so a
 * page never reaches into a component file directly.
 */

export { AlertItem, type AlertItemProps } from './AlertItem';
export { Card, type CardProps } from './Card';
export { DataTable, type Column, type DataTableProps } from './DataTable';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { KpiTile, type KpiTileProps } from './KpiTile';
export { SectionHeader, type SectionHeaderProps } from './SectionHeader';
export { Skeleton, SkeletonKpiGrid, SkeletonKpiTile, SkeletonPanel } from './Skeleton';
export { Sparkline, type SparklineProps } from './Sparkline';
export { StatusBadge, type StatusBadgeProps, type StatusTone } from './StatusBadge';
export { Reveal, type RevealProps } from './Reveal';
export { EASE, TRANSITION, enter, stagger, still } from './motion';
