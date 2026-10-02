// Straight-line distance and a rough I-80 milepost lookup. No maps, by design.

const R_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.sqrt(a));
}

// Nebraska I-80 anchors: [milepost, lat, lng]. Used when a signal has a milepost but no GPS
// (driver messages). Linear interpolation is plenty for a demo.
const I80_NE: [number, number, number][] = [
  [59, 41.14, -102.98], // Sidney
  [126, 41.13, -101.72], // Ogallala
  [177, 41.14, -100.76], // North Platte
  [272, 40.7, -99.08], // Kearney
  [312, 40.93, -98.34], // Grand Island
  [395, 40.81, -96.7], // Lincoln
  [445, 41.26, -95.93], // Omaha
];

export function milepostToLatLng(mp: number): { lat: number; lng: number } {
  const pts = I80_NE;
  if (mp <= pts[0][0]) return { lat: pts[0][1], lng: pts[0][2] };
  for (let i = 1; i < pts.length; i++) {
    if (mp <= pts[i][0]) {
      const [m0, la0, ln0] = pts[i - 1];
      const [m1, la1, ln1] = pts[i];
      const t = (mp - m0) / (m1 - m0);
      return { lat: la0 + t * (la1 - la0), lng: ln0 + t * (ln1 - ln0) };
    }
  }
  const last = pts[pts.length - 1];
  return { lat: last[1], lng: last[2] };
}
