export type MessageCoords = {
  lat: number;
  lng: number;
  label?: string;
  recordedAt?: string;
};

export function getMessageCoordinates(
  metadata: Record<string, unknown> | null | undefined,
): MessageCoords | null {
  if (!metadata) return null;

  const latRaw =
    typeof metadata.latitude === "number"
      ? metadata.latitude
      : typeof metadata.lat === "number"
        ? metadata.lat
        : null;
  const lngRaw =
    typeof metadata.longitude === "number"
      ? metadata.longitude
      : typeof metadata.lng === "number"
        ? metadata.lng
        : null;

  if (latRaw == null || lngRaw == null) return null;
  if (Math.abs(latRaw) > 90 || Math.abs(lngRaw) > 180) return null;

  const label = typeof metadata.label === "string" ? metadata.label : undefined;
  const recordedAt =
    typeof metadata.timestamp === "string"
      ? metadata.timestamp
      : typeof metadata.recorded_at === "string"
        ? metadata.recorded_at
        : undefined;

  return { lat: latRaw, lng: lngRaw, label, recordedAt };
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function mapboxStaticImageUrl(lat: number, lng: number, token: string): string {
  return `https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/pin-s+00c7a2(${lng},${lat})/${lng},${lat},15,0/320x160@2x?access_token=${encodeURIComponent(token)}`;
}
