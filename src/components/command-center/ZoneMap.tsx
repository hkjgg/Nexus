'use client';

/**
 * The mini-map: eight zone polygons coloured by on-time rate, with the fleet's
 * last known positions on top.
 *
 * The basemap is CARTO's dark-matter raster tiles, which need no API key and
 * no account. Two deliberate choices keep the data on screen when that CDN is
 * not:
 *
 *   - the style is declared here rather than fetched as a hosted style
 *     document, and the zone and driver layers are part of it, so they are
 *     applied with the style instead of being installed later from a `load`
 *     event that never fires while tile requests are failing;
 *   - colours are read from the design tokens at mount. MapLibre parses paint
 *     properties itself and knows nothing about the cascade, so a literal
 *     `var(--nx-critical)` on a fill silently paints nothing.
 */

import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection, Point, Polygon } from 'geojson';
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJsonPolygon } from '@/lib/db/types';
import { ZONE_HEALTH_LEGEND, ZONE_HEALTH_META, zoneHealth } from '@/lib/zone-health';

export type ZoneShape = {
  code: string;
  name: string;
  polygon: GeoJsonPolygon;
  onTimeRate: number | null;
  ordersCount: number;
};

export type DriverDot = {
  driverId: string;
  fullName: string;
  lat: number;
  lng: number;
};

export type ZoneMapProps = {
  zones: readonly ZoneShape[];
  drivers: readonly DriverDot[];
  /** Highlights one zone and dims the others. */
  focusZoneCode?: string | null;
};

const BASEMAP_ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright">&copy; OpenStreetMap</a> contributors, ' +
  '<a href="https://carto.com/attributions">&copy; CARTO</a>';

/** Centre of the demo operation, used until the zones arrive and set bounds. */
const INITIAL_CENTER: [number, number] = [35.5, 33.89];

/**
 * Reads a design token off the document root.
 *
 * Returns the fallback during server rendering and if the token is missing, so
 * a mistyped name degrades to a visible colour rather than an invisible layer.
 */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

type ZoneFeatureProps = {
  code: string;
  name: string;
  color: string;
  onTimeLabel: string;
  orders: number;
  dimmed: number;
};

function zoneCollection(
  zones: readonly ZoneShape[],
  focusZoneCode?: string | null,
): FeatureCollection<Polygon, ZoneFeatureProps> {
  return {
    type: 'FeatureCollection',
    features: zones.map((zone) => ({
      type: 'Feature',
      geometry: zone.polygon,
      properties: {
        code: zone.code,
        name: zone.name,
        color: token(ZONE_HEALTH_META[zoneHealth(zone.onTimeRate)].token, '#6d7b8e'),
        onTimeLabel:
          zone.onTimeRate === null
            ? 'no deliveries'
            : `${(zone.onTimeRate * 100).toFixed(1)}% on time`,
        orders: zone.ordersCount,
        dimmed: focusZoneCode && zone.code !== focusZoneCode ? 1 : 0,
      },
    })),
  };
}

function driverCollection(
  drivers: readonly DriverDot[],
): FeatureCollection<Point, { name: string }> {
  return {
    type: 'FeatureCollection',
    features: drivers.map((driver) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [driver.lng, driver.lat] },
      properties: { name: driver.fullName },
    })),
  };
}

/** The whole style, data layers included, built once per mount. */
function buildStyle(): maplibregl.StyleSpecification {
  const empty: FeatureCollection<Polygon | Point, Record<string, never>> = {
    type: 'FeatureCollection',
    features: [],
  };

  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: BASEMAP_ATTRIBUTION,
      },
      zones: { type: 'geojson', data: empty },
      drivers: { type: 'geojson', data: empty },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': token('--nx-sunken', '#070a0e') },
      },
      { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.85 } },
      {
        id: 'zone-fill',
        type: 'fill',
        source: 'zones',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': ['case', ['==', ['get', 'dimmed'], 1], 0.06, 0.2],
        },
      },
      {
        id: 'zone-outline',
        type: 'line',
        source: 'zones',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['==', ['get', 'dimmed'], 1], 0.75, 1.5],
          'line-opacity': ['case', ['==', ['get', 'dimmed'], 1], 0.4, 0.9],
        },
      },
      {
        id: 'driver-dots',
        type: 'circle',
        source: 'drivers',
        paint: {
          'circle-radius': 3.5,
          'circle-color': token('--nx-text', '#e4e9f0'),
          'circle-opacity': 0.85,
          // A ring in the surface colour keeps overlapping dots countable.
          'circle-stroke-width': 1,
          'circle-stroke-color': token('--nx-surface', '#10151d'),
        },
      },
    ],
  };
}

/** Bounding box of every zone ring, so the map opens on the whole operation. */
function boundsOf(zones: readonly ZoneShape[]): maplibregl.LngLatBounds | null {
  const bounds = new maplibregl.LngLatBounds();
  let seen = false;

  for (const zone of zones) {
    for (const ring of zone.polygon.coordinates) {
      for (const [lng, lat] of ring) {
        bounds.extend([lng, lat]);
        seen = true;
      }
    }
  }

  return seen ? bounds : null;
}

export function ZoneMap({ zones, drivers, focusZoneCode }: ZoneMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);

  // Create the map once; data updates go through the sources below.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(),
      center: INITIAL_CENTER,
      zoom: 10.2,
      attributionControl: { compact: true },
      // The map is a read-only overview; rotating it helps nobody.
      dragRotate: false,
      pitchWithRotate: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.scrollZoom.disable();

    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8 });

    map.on('mousemove', 'zone-fill', (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      map.getCanvas().style.cursor = 'pointer';
      const props = feature.properties as ZoneFeatureProps;
      popup
        .setLngLat(event.lngLat)
        .setHTML(
          `<strong>${props.code} ${props.name}</strong><br/>${props.onTimeLabel} &middot; ${props.orders} orders`,
        )
        .addTo(map);
    });

    map.on('mouseleave', 'zone-fill', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });

    // The sources arrive with the style, so "ready" is simply the first moment
    // they can be addressed. Waiting for `load` would mean waiting for the
    // basemap tiles, which is exactly what must not gate the data.
    const markReady = () => {
      if (map.getSource('zones')) setReady(true);
    };
    map.on('styledata', markReady);
    markReady();

    mapRef.current = map;

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, []);

  // Push zone geometry and colours whenever the range or zone filter changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource('zones') as GeoJSONSource | undefined;
    source?.setData(zoneCollection(zones, focusZoneCode));

    const bounds = boundsOf(zones);
    if (bounds) map.fitBounds(bounds, { padding: 24, duration: 0, maxZoom: 12 });
  }, [zones, focusZoneCode, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const source = map.getSource('drivers') as GeoJSONSource | undefined;
    source?.setData(driverCollection(drivers));
  }, [drivers, ready]);

  return (
    <div>
      <div
        ref={containerRef}
        className="bg-sunken h-72 w-full"
        role="img"
        aria-label={`Map of ${zones.length} delivery zones coloured by on-time rate, with ${drivers.length} driver positions`}
      />

      <div className="border-line-subtle text-secondary flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t px-4 py-2.5">
        <span className="text-faint text-[0.625rem] tracking-wide uppercase">On-time rate</span>
        {ZONE_HEALTH_LEGEND.map((entry) => (
          <span key={entry.health} className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: `var(${ZONE_HEALTH_META[entry.health].token})` }}
              aria-hidden
            />
            <span className="text-[0.6875rem]">{ZONE_HEALTH_META[entry.health].label}</span>
            <span className="nx-numeric text-faint text-[0.6875rem]">{entry.label}</span>
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ background: 'var(--nx-text)' }}
            aria-hidden
          />
          <span className="text-[0.6875rem]">Driver</span>
        </span>
      </div>
    </div>
  );
}
