'use client';

import { useEffect, useRef, useState } from 'react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GeoJsonPolygon } from '@/lib/db/types';
import { cn } from '@/lib/ui/cn';
import { bandColor, DRIVER_COLORS } from './service-bands';

export type MapZone = {
  id: string;
  code: string;
  name: string;
  polygon: GeoJsonPolygon;
  onTimeRate: number | null;
  ordersCount: number;
};

export type MapDriver = {
  id: string;
  fullName: string;
  status: 'on_shift' | 'off_shift' | 'on_break';
  lat: number;
  lng: number;
  live: boolean;
};

/**
 * The city, its eight zones coloured by service, and where the drivers are.
 *
 * The basemap is CARTO's dark-matter style, which is free and needs no API
 * key, so nothing here depends on a token that could expire or leak.
 *
 * MapLibre is loaded inside an effect rather than imported at the top of the
 * module: it reaches for `window` on import, and this component is rendered
 * on the server first.
 */
export function ZoneMap({ zones, drivers }: { zones: MapZone[]; drivers: MapDriver[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let map: { remove: () => void } | null = null;
    let cancelled = false;

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    void (async () => {
      try {
        const maplibre = await import('maplibre-gl');
        if (cancelled) return;

        const instance = new maplibre.Map({
          container,
          style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
          center: [0, 0],
          zoom: 1,
          attributionControl: { compact: true },
          // The mini-map is a picture, not a tool: scroll belongs to the page.
          scrollZoom: false,
        });
        map = instance;

        instance.addControl(new maplibre.NavigationControl({ showCompass: false }), 'top-right');

        instance.on('error', () => setStatus('failed'));

        instance.on('load', () => {
          if (cancelled) return;

          instance.addSource('zones', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: zones.map((zone) => ({
                type: 'Feature' as const,
                id: zone.code,
                geometry: zone.polygon,
                properties: {
                  code: zone.code,
                  name: zone.name,
                  color: bandColor(zone.onTimeRate),
                  onTime: zone.onTimeRate === null ? '-' : `${(zone.onTimeRate * 100).toFixed(1)}%`,
                  orders: zone.ordersCount.toLocaleString('en-US'),
                },
              })),
            },
          });

          instance.addLayer({
            id: 'zone-fill',
            type: 'fill',
            source: 'zones',
            paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.3 },
          });

          instance.addLayer({
            id: 'zone-outline',
            type: 'line',
            source: 'zones',
            paint: { 'line-color': ['get', 'color'], 'line-width': 1.5 },
          });

          instance.addLayer({
            id: 'zone-label',
            type: 'symbol',
            source: 'zones',
            layout: {
              'text-field': ['get', 'code'],
              'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
              'text-size': 11,
              'text-allow-overlap': false,
            },
            paint: {
              'text-color': '#e6ebf2',
              'text-halo-color': '#0b0e13',
              'text-halo-width': 1.2,
            },
          });

          instance.addSource('drivers', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: drivers.map((driver) => ({
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: [driver.lng, driver.lat] },
                properties: {
                  name: driver.fullName,
                  color: DRIVER_COLORS[driver.status],
                  live: driver.live ? 'live' : 'last known',
                },
              })),
            },
          });

          instance.addLayer({
            id: 'driver-dots',
            type: 'circle',
            source: 'drivers',
            paint: {
              'circle-radius': 3.5,
              'circle-color': ['get', 'color'],
              // A ring in the surface colour lifts overlapping dots apart.
              'circle-stroke-color': '#0b0e13',
              'circle-stroke-width': 1,
            },
          });

          // Frame the whole service area rather than guessing a centre.
          const bounds = new maplibre.LngLatBounds();
          for (const zone of zones) {
            for (const ring of zone.polygon.coordinates) {
              for (const position of ring) bounds.extend(position);
            }
          }
          if (!bounds.isEmpty()) {
            instance.fitBounds(bounds, { padding: 24, animate: !reduceMotion, duration: 0 });
          }

          const popup = new maplibre.Popup({ closeButton: false, closeOnClick: false });

          instance.on('mousemove', 'zone-fill', (event) => {
            const feature = event.features?.[0];
            if (!feature) return;
            instance.getCanvas().style.cursor = 'pointer';
            const properties = feature.properties as Record<string, string>;
            popup
              .setLngLat(event.lngLat)
              .setHTML(
                `<strong>${properties.code}</strong> ${properties.name}<br />` +
                  `${properties.onTime} on time · ${properties.orders} orders`,
              )
              .addTo(instance);
          });

          instance.on('mouseleave', 'zone-fill', () => {
            instance.getCanvas().style.cursor = '';
            popup.remove();
          });

          setStatus('ready');
        });
      } catch {
        if (!cancelled) setStatus('failed');
      }
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [zones, drivers]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="bg-inset h-72 w-full"
        role="img"
        aria-label={`Map of ${zones.length} service zones coloured by on-time rate, with ${drivers.length} driver positions`}
      />

      {status !== 'ready' ? (
        <div
          className={cn(
            'bg-inset absolute inset-0 flex items-center justify-center',
            'text-ink-faint text-xs',
          )}
        >
          {status === 'failed'
            ? 'The basemap could not be loaded. Zone figures are in the table above.'
            : 'Loading map…'}
        </div>
      ) : null}
    </div>
  );
}
