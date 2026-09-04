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

const origins: readonly OriginSeed[] = [
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

const roasts: readonly RoastLevelET[] = ['light', 'medium', 'mediumDark', 'dark'];
const processes: readonly CoffeeProcessET[] = ['washed', 'natural', 'honey', 'anaerobic'];

const notes: readonly string[] = [
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

const seedCount = 96;

function pad(value: number, size = 3): string {
  return String(value).padStart(size, '0');
}

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length];
}

function buildSeed(): readonly Bean[] {
  return Array.from({ length: seedCount }, (_, i): Bean => {
    const origin = pick(origins, i);

    // `slot` walks the region x lot grid of one origin exactly once, so all 96
    // lot names are distinct instead of a handful repeating.
    const slot = Math.floor(i / origins.length);
    const region = pick(origin.regions, slot);
    const lot = pick(origin.lots, Math.floor(slot / origin.regions.length));

    return {
      id: `LOT-${pad(i + 1)}`,
      name: `${region} ${lot}`,
      origin: origin.country,
      region,
      roast: pick(roasts, i * 3),
      process: pick(processes, i * 5 + 1),
      tastingNotes: [pick(notes, i * 7), pick(notes, i * 7 + 3), pick(notes, i * 7 + 9)],
      // The modulus must be coprime with the multiplier or the spread collapses:
      // gcd(13, 39) = 13, so `(i * 13) % 39` only ever yields 0, 13 or 26 - three
      // distinct scores across the whole catalog, with a third of the lots tied
      // at the top. 37 is prime, so this walks all 37 residues (82.00 - 91.00)
      // and stays as deterministic as before.
      score: Number((82 + ((i * 13) % 37) / 4).toFixed(2)),
      pricePerKg: Number((8.4 + ((i * 13) % 74) / 4).toFixed(2)),
      stockKg: 15 + ((i * 37) % 46) * 5,
      harvestYear: 2024 + (i % 2),
    };
  });
}

export const beansSeed: readonly Bean[] = buildSeed();
