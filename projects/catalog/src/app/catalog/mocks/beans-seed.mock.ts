import type { CoffeeProcessET } from '../enums/coffee-process.enum';
import type { RoastLevelET } from '../enums/roast-level.enum';
import type { Bean } from '../models/bean.model';

/**
 * Deterministic seed for the mocked catalog backend. Generated from fixed
 * indices rather than randomness so the demo shows the same numbers on every
 * reload - useful when the same screen is on a projector twice in a row.
 */

interface OriginSeed {
  country: string;
  regions: readonly string[];
  lots: readonly string[];
}

const ORIGINS: readonly OriginSeed[] = [
  {
    country: 'Ethiopia',
    regions: ['Yirgacheffe', 'Guji', 'Sidama'],
    lots: ['Kochere', 'Hambela', 'Bombe', 'Chelbesa'],
  },
  {
    country: 'Colombia',
    regions: ['Huila', 'Nariño', 'Tolima'],
    lots: ['La Esperanza', 'El Mirador', 'Finca Aurora', 'Los Naranjos'],
  },
  {
    country: 'Kenya',
    regions: ['Nyeri', 'Kirinyaga', 'Embu'],
    lots: ['Gatomboya', 'Kianjuki', 'Karatina', 'Kamwangi'],
  },
  {
    country: 'Guatemala',
    regions: ['Huehuetenango', 'Antigua', 'Atitlán'],
    lots: ['La Bolsa', 'Santa Clara', 'El Injerto', 'Finca Rosma'],
  },
  {
    country: 'Brazil',
    regions: ['Cerrado', 'Sul de Minas', 'Mogiana'],
    lots: ['Fazenda Rainha', 'Sertãozinho', 'Capim Branco', 'Sítio Bela Vista'],
  },
  {
    country: 'Indonesia',
    regions: ['Sumatra', 'Java', 'Sulawesi'],
    lots: ['Gayo Highlands', 'Blawan Estate', 'Lintong', 'Toraja Sapan'],
  },
  {
    country: 'Costa Rica',
    regions: ['Tarrazú', 'West Valley', 'Brunca'],
    lots: ['Don Mayo', 'Las Lajas', 'Herbazú', 'Sonora'],
  },
  {
    country: 'Rwanda',
    regions: ['Nyamasheke', 'Huye', 'Gakenke'],
    lots: ['Gitesi', 'Bumbogo', 'Kilimbi', 'Rugali'],
  },
];

const ROASTS: readonly RoastLevelET[] = ['light', 'medium', 'mediumDark', 'dark'];
const PROCESSES: readonly CoffeeProcessET[] = ['washed', 'natural', 'honey', 'anaerobic'];

const NOTES: readonly string[] = [
  'jasmine',
  'bergamot',
  'stone fruit',
  'blackcurrant',
  'milk chocolate',
  'brown sugar',
  'red apple',
  'toffee',
  'dried fig',
  'hazelnut',
  'lime zest',
  'cocoa nib',
  'peach',
  'molasses',
  'rhubarb',
  'almond',
];

const SEED_COUNT = 96;

function pad(value: number, size = 3): string {
  return String(value).padStart(size, '0');
}

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length];
}

function buildSeed(): readonly Bean[] {
  return Array.from({ length: SEED_COUNT }, (_, i): Bean => {
    const origin = pick(ORIGINS, i);

    // `slot` walks the region x lot grid of one origin exactly once, so all 96
    // lot names are distinct instead of a handful repeating.
    const slot = Math.floor(i / ORIGINS.length);
    const region = pick(origin.regions, slot);
    const lot = pick(origin.lots, Math.floor(slot / origin.regions.length));

    return {
      id: `LOT-${pad(i + 1)}`,
      name: `${region} ${lot}`,
      origin: origin.country,
      region,
      roast: pick(ROASTS, i * 3),
      process: pick(PROCESSES, i * 5 + 1),
      tastingNotes: [pick(NOTES, i * 7), pick(NOTES, i * 7 + 3), pick(NOTES, i * 7 + 9)],
      score: Number((82 + ((i * 13) % 39) / 4).toFixed(2)),
      pricePerKg: Number((8.4 + ((i * 13) % 74) / 4).toFixed(2)),
      stockKg: 15 + ((i * 37) % 46) * 5,
      harvestYear: 2024 + (i % 2),
    };
  });
}

export const BEANS_SEED: readonly Bean[] = buildSeed();
