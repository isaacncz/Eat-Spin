import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { GroupRoomParticipant } from '@/hooks/useFirebaseGroupRoom';
import { computeCentroid, computeAutoRadius, type GeoPoint } from '@/lib/centroid';

// ---------------------------------------------------------------------------
// Marker icon factories
// ---------------------------------------------------------------------------

/** Coloured circle with the participant's initial. */
function createParticipantIcon(name: string, isYou: boolean) {
  const initial = (name[0] ?? '?').toUpperCase();
  const bg = isYou ? '#f97316' : '#3b82f6'; // orange-500 vs blue-500
  return L.divIcon({
    className: '', // suppress default leaflet-div-icon styling
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <span style="
          font-size:11px;font-weight:700;color:#1e293b;
          white-space:nowrap;text-shadow:0 1px 2px rgba(255,255,255,.9);
          margin-bottom:2px;
        ">${name}</span>
        <span style="
          width:28px;height:28px;border-radius:50%;
          background:${bg};border:2px solid #fff;
          display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:700;color:#fff;
          box-shadow:0 2px 6px rgba(0,0,0,.25);
        ">${initial}</span>
      </div>
    `,
  });
}

/** Pulsing orange dot for the centroid. */
const centroidIcon = L.divIcon({
  className: '',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  html: `
    <div style="position:relative;width:24px;height:24px;">
      <span style="
        position:absolute;inset:0;border-radius:50%;
        background:rgba(249,115,22,.35);
        animation:midspin-pulse 2s ease-in-out infinite;
      "></span>
      <span style="
        position:absolute;top:6px;left:6px;width:12px;height:12px;
        border-radius:50%;background:#f97316;border:2px solid #fff;
        box-shadow:0 2px 4px rgba(0,0,0,.3);
      "></span>
    </div>
  `,
});

// Inject the pulsing keyframes once
if (typeof document !== 'undefined' && !document.getElementById('midspin-pulse-style')) {
  const style = document.createElement('style');
  style.id = 'midspin-pulse-style';
  style.textContent = `
    @keyframes midspin-pulse {
      0%, 100% { transform: scale(1); opacity: .6; }
      50% { transform: scale(1.8); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Auto-fit helper (runs inside MapContainer context)
// ---------------------------------------------------------------------------

function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();
  const prevKeyRef = useRef('');

  useEffect(() => {
    if (points.length === 0) return;
    const key = points.map((p) => `${p.lat},${p.lng}`).join('|');
    if (key === prevKeyRef.current) return;
    prevKeyRef.current = key;

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [map, points]);

  return null;
}

// ---------------------------------------------------------------------------
// MidSpinMap
// ---------------------------------------------------------------------------

interface MidSpinMapProps {
  participants: GroupRoomParticipant[];
  authUid: string | null;
  className?: string;
}

export function MidSpinMap({ participants, authUid, className }: MidSpinMapProps) {
  const locatedParticipants = useMemo(
    () => participants.filter((p): p is GroupRoomParticipant & { lat: number; lng: number } =>
      p.lat !== undefined && p.lng !== undefined,
    ),
    [participants],
  );

  const geoPoints: GeoPoint[] = useMemo(
    () => locatedParticipants.map((p) => ({ lat: p.lat, lng: p.lng })),
    [locatedParticipants],
  );

  const centroid = useMemo(() => computeCentroid(geoPoints), [geoPoints]);
  const autoRadius = useMemo(
    () => (centroid ? computeAutoRadius(centroid, geoPoints) : 0),
    [centroid, geoPoints],
  );

  const allPoints = useMemo(() => {
    if (!centroid) return geoPoints;
    return [...geoPoints, centroid];
  }, [geoPoints, centroid]);

  // Default centre: Singapore, updated once participants arrive
  const defaultCenter: [number, number] = [1.3521, 103.8198];

  return (
    <div className={className}>
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom
        style={{ width: '100%', height: '100%', borderRadius: '0.75rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={allPoints} />

        {/* Participant markers */}
        {locatedParticipants.map((p) => (
          <Marker
            key={p.uid}
            position={[p.lat, p.lng]}
            icon={createParticipantIcon(p.name, p.uid === authUid)}
          >
            <Popup>{p.name}{p.uid === authUid ? ' (You)' : ''}</Popup>
          </Marker>
        ))}

        {/* Centroid marker */}
        {centroid && locatedParticipants.length >= 2 && (
          <Marker position={[centroid.lat, centroid.lng]} icon={centroidIcon}>
            <Popup>
              Midpoint
              {autoRadius > 0 && (
                <span className="block text-xs text-gray-500">
                  Search radius: {autoRadius >= 1000 ? `${(autoRadius / 1000).toFixed(1)} km` : `${autoRadius} m`}
                </span>
              )}
            </Popup>
          </Marker>
        )}
      </MapContainer>

      {/* Legend strip below map */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-eatspin-gray-1">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
          Friends
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-brand-orange" />
          You
        </span>
        {centroid && locatedParticipants.length >= 2 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full border-2 border-brand-orange bg-brand-orange/30" />
            Midpoint
          </span>
        )}
        <span className="ml-auto">
          {locatedParticipants.length}/{participants.length} located
        </span>
      </div>
    </div>
  );
}
