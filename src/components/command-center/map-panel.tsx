import { Card, SectionHeader } from '@/components/nexus';
import { SERVICE_BANDS } from './service-bands';
import { ZoneMap, type MapDriver, type MapZone } from './zone-map';

type MapPanelProps = {
  zones: MapZone[];
  drivers: MapDriver[];
};

/**
 * The map and the key it needs to be read.
 *
 * The legend is not optional chrome: the polygons carry their meaning in
 * colour alone, so without the bands spelled out the map is decoration.
 */
export function MapPanel({ zones, drivers }: MapPanelProps) {
  const live = drivers.filter((driver) => driver.live).length;

  return (
    <Card flush className="overflow-hidden">
      <div className="border-line border-b p-4">
        <SectionHeader
          title="Service map"
          description={
            live > 0
              ? `${live} of ${drivers.length} drivers reporting live`
              : `No driver is on shift right now; showing ${drivers.length} last known positions`
          }
        />
      </div>

      <ZoneMap zones={zones} drivers={drivers} />

      <div className="border-line flex flex-wrap items-center gap-x-4 gap-y-2 border-t p-3">
        <span className="text-ink-faint text-[0.68rem] tracking-wider uppercase">On-time rate</span>
        {SERVICE_BANDS.map((band) => (
          <span
            key={band.label}
            className="text-ink-muted flex items-center gap-1.5 text-[0.68rem]"
          >
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: band.color }}
              aria-hidden
            />
            {band.label}
          </span>
        ))}
      </div>
    </Card>
  );
}
