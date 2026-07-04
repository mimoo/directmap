// Optional "postcard from the real world" rounds, powered by the Google
// Street View Static + Maps Static APIs. Only used when the player has
// entered their own API key; the game never requires it.
//
// The question is honest by construction: we request the photo with an
// explicit `heading` parameter, so the correct answer is exactly the
// cardinal we asked Google for.

import type { Heading } from './dir'
import { makeRng, pick } from './rng'

export interface RealPlace {
  name: string
  lat: number
  lng: number
}

/** Distinctive spots with long-standing Street View coverage. */
export const REAL_PLACES: RealPlace[] = [
  { name: 'Times Square, New York', lat: 40.758, lng: -73.9855 },
  { name: 'Champs-Élysées, Paris', lat: 48.8698, lng: 2.3075 },
  { name: 'Trafalgar Square, London', lat: 51.508, lng: -0.128 },
  { name: 'Piazza del Colosseo, Rome', lat: 41.8902, lng: 12.4922 },
  { name: 'Dam Square, Amsterdam', lat: 52.373, lng: 4.8924 },
  { name: 'Shibuya Crossing, Tokyo', lat: 35.6595, lng: 139.7005 },
  { name: 'Sagrada Família, Barcelona', lat: 41.4036, lng: 2.1744 },
  { name: 'Brandenburg Gate, Berlin', lat: 52.5163, lng: 13.3777 },
  { name: 'Lombard Street, San Francisco', lat: 37.8021, lng: -122.4187 },
  { name: 'Macquarie Street, Sydney', lat: -33.8641, lng: 151.213 },
]

export interface RealQuestion {
  mode: 'real-view'
  place: RealPlace
  /** The cardinal the camera faces — the answer. */
  heading: Heading
}

export function generateRealPuzzle(seed: number): RealQuestion {
  const rng = makeRng(seed)
  return {
    mode: 'real-view',
    place: pick(rng, REAL_PLACES),
    heading: pick(rng, [0, 1, 2, 3] as Heading[]),
  }
}

export const HEADING_DEGREES: Record<Heading, number> = { 0: 0, 1: 90, 2: 180, 3: 270 }

export function streetViewUrl(key: string, place: RealPlace, heading: Heading): string {
  const params = new URLSearchParams({
    size: '520x340',
    location: `${place.lat},${place.lng}`,
    heading: String(HEADING_DEGREES[heading]),
    fov: '90',
    key,
  })
  return `https://maps.googleapis.com/maps/api/streetview?${params}`
}

export function staticMapUrl(key: string, place: RealPlace): string {
  const params = new URLSearchParams({
    center: `${place.lat},${place.lng}`,
    zoom: '17',
    size: '520x340',
    scale: '2',
    markers: `color:red|${place.lat},${place.lng}`,
    key,
  })
  return `https://maps.googleapis.com/maps/api/staticmap?${params}`
}
