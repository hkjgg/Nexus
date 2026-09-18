/**
 * Domain types mirroring the Postgres schema in supabase/migrations.
 *
 * These are the single source of truth for the shape of NEXUS data in
 * TypeScript. Keep them in step with the migrations.
 */

export type VehicleType = 'motorbike' | 'van' | 'truck';
export type VehicleStatus = 'active' | 'maintenance' | 'idle';
export type DriverStatus = 'on_shift' | 'off_shift' | 'on_break';

export type OrderStatus =
  | 'pending'
  | 'assigned'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'delayed'
  | 'cancelled'
  | 'failed';

export type OrderChannel = 'website' | 'app' | 'pos' | 'marketplace' | 'phone';

export type ExpenseCategory = 'fuel' | 'maintenance' | 'driver_wage' | 'vehicle_fixed' | 'overhead';

export type AlertType = 'operational' | 'capacity' | 'financial' | 'fleet' | 'anomaly';
export type AlertSeverity = 'info' | 'warning' | 'critical';

/** A GeoJSON Polygon, as stored in zones.polygon. */
export type GeoJsonPolygon = {
  type: 'Polygon';
  /** Ring coordinates in [longitude, latitude] order, first point repeated last. */
  coordinates: [number, number][][];
};

export type Company = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  is_demo: boolean;
  created_at: string;
};

export type Zone = {
  id: string;
  company_id: string;
  name: string;
  code: string;
  polygon: GeoJsonPolygon;
  center_lat: number;
  center_lng: number;
  base_demand_weight: number;
  created_at: string;
};

export type Vehicle = {
  id: string;
  company_id: string;
  plate: string;
  type: VehicleType;
  fuel_type: string;
  fuel_efficiency_km_per_l: number;
  fixed_cost_per_day: number;
  status: VehicleStatus;
  odometer_km: number;
  created_at: string;
};

export type Driver = {
  id: string;
  company_id: string;
  full_name: string;
  phone: string | null;
  home_zone_id: string | null;
  vehicle_id: string | null;
  shift_start: string;
  shift_end: string;
  cost_per_hour: number;
  status: DriverStatus;
  current_lat: number | null;
  current_lng: number | null;
  created_at: string;
};

export type Order = {
  id: string;
  company_id: string;
  order_number: string;
  zone_id: string;
  driver_id: string | null;
  status: OrderStatus;
  channel: OrderChannel;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  distance_km: number;
  delivery_fee: number;
  promised_at: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

export type OrderEvent = {
  id: string;
  company_id: string;
  order_id: string;
  event_type: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus | null;
  occurred_at: string;
  meta: Record<string, unknown>;
  created_at: string;
};

export type DriverShift = {
  id: string;
  company_id: string;
  driver_id: string;
  /** ISO date, no time component. */
  date: string;
  started_at: string | null;
  ended_at: string | null;
  active_minutes: number;
  idle_minutes: number;
  created_at: string;
};

export type Expense = {
  id: string;
  company_id: string;
  category: ExpenseCategory;
  vehicle_id: string | null;
  driver_id: string | null;
  amount: number;
  liters: number | null;
  occurred_at: string;
  created_at: string;
};

export type Alert = {
  id: string;
  company_id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  metric: string | null;
  value: number | null;
  threshold: number | null;
  resolved_at: string | null;
  created_at: string;
};
