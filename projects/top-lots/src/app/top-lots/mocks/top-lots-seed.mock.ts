import type { Lot } from '../models/lot.model';

/**
 * This microfrontend's own backend data, deliberately not the catalog's.
 *
 * Written out literally rather than generated from indices: at eight rows a
 * table is clearer than a formula, and it is exactly as reproducible. The larger
 * seeds in this workspace use index arithmetic because they have ninety-odd rows
 * - and when they do, the multiplier must be coprime with the modulus or the
 * spread collapses.
 *
 * Because this is a separate service with separate data, the numbers here do not
 * match what the catalog application reports. That is the honest consequence of
 * an independently deployed microfrontend, not a bug to reconcile.
 */
export const topLotsSeed: readonly Lot[] = [
  {
    id: 'LOT-2201',
    name: 'Kirinyaga Kianjuki AA',
    origin: 'Kenya',
    roast: 'mediumDark',
    score: 91.5,
  },
  {
    id: 'LOT-2202',
    name: 'Guji Shakiso Natural',
    origin: 'Ethiopia',
    roast: 'light',
    score: 90.75,
  },
  { id: 'LOT-2203', name: 'Gakenke Kilimbi', origin: 'Rwanda', roast: 'medium', score: 90.25 },
  { id: 'LOT-2204', name: 'Tolima La Esperanza', origin: 'Colombia', roast: 'dark', score: 89.5 },
  {
    id: 'LOT-2205',
    name: 'Tarrazú Herbazú',
    origin: 'Costa Rica',
    roast: 'mediumDark',
    score: 88.75,
  },
  { id: 'LOT-2206', name: 'Antigua La Bolsa', origin: 'Guatemala', roast: 'medium', score: 88.0 },
  {
    id: 'LOT-2207',
    name: 'Gayo Highlands Wet-Hulled',
    origin: 'Indonesia',
    roast: 'dark',
    score: 87.25,
  },
  { id: 'LOT-2208', name: 'Huila Bruselas', origin: 'Colombia', roast: 'light', score: 86.5 },
];
