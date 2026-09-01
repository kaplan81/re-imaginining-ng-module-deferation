import { ORDER_STATUSES, type OrderStatusET } from '../enums/order-status.enum';
import type { Order } from '../models/order.model';

/**
 * Deterministic seed for the mocked fulfilment backend.
 *
 * `REFERENCE_TODAY` is a fixed date rather than `Date.now()`: a demo that shows
 * "3 days late" should show the same thing next month, and tests should not need
 * to freeze the clock.
 */
export const REFERENCE_TODAY = '2026-09-01';

interface CustomerSeed {
  name: string;
  city: string;
}

const CUSTOMERS: readonly CustomerSeed[] = [
  { name: 'Kaffeehaus Nord', city: 'Hamburg' },
  { name: 'Le Petit Grain', city: 'Lyon' },
  { name: 'Bica & Co.', city: 'Lisbon' },
  { name: 'Third Wave Zürich', city: 'Zürich' },
  { name: 'Bräu & Bohne', city: 'Vienna' },
  { name: 'Slow Pour Rotterdam', city: 'Rotterdam' },
  { name: 'Caffè Sospeso', city: 'Bologna' },
  { name: 'Nordic Roasters Union', city: 'Oslo' },
  { name: 'Barrio Tostado', city: 'Madrid' },
  { name: 'Dublin Drip House', city: 'Dublin' },
  { name: 'Kraków Roast Club', city: 'Kraków' },
  { name: 'Copenhagen Cupping Lab', city: 'Copenhagen' },
];

const BLENDS: readonly string[] = [
  'House Espresso',
  'Morning Filter',
  'Decaf Sunset',
  'Single Origin Rotation',
  'Cold Brew Base',
  'Winter Blend',
  'Barista Reserve',
];

const SEED_COUNT = 84;
const MS_PER_DAY = 86_400_000;

function pad(value: number, size = 5): string {
  return String(value).padStart(size, '0');
}

function pick<T>(values: readonly T[], index: number): T {
  return values[index % values.length];
}

function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Due dates follow the pipeline - intake furthest out, delivered just behind us -
 * and on-hold orders are pushed well into the past on purpose, so a board sorted
 * by due date opens on the rows that actually need attention.
 */
function dueOffsetFor(status: OrderStatusET, index: number): number {
  switch (status) {
    case 'intake':
      return 6 + (index % 12);
    case 'roasting':
      return 2 + (index % 6);
    case 'packed':
      return index % 4;
    case 'onHold':
      return -12 - (index % 19);
    case 'shipped':
      return -6 - (index % 5);
    default:
      return -1 - (index % 5);
  }
}

function buildSeed(): readonly Order[] {
  return Array.from({ length: SEED_COUNT }, (_, i): Order => {
    const customer = pick(CUSTOMERS, i * 5 + 1);
    const status = pick(ORDER_STATUSES, i * 7 + 2);
    const quantityKg = 12 + ((i * 17) % 24) * 6;
    const daysToDue = dueOffsetFor(status, i);

    return {
      id: `order-${pad(i + 1)}`,
      reference: `RO-${pad(10_200 + i * 3, 5)}`,
      customer: customer.name,
      city: customer.city,
      blend: pick(BLENDS, i * 3),
      status,
      quantityKg,
      totalEur: Number((quantityKg * (14.5 + ((i * 11) % 40) / 4)).toFixed(2)),
      placedAt: shiftDays(REFERENCE_TODAY, daysToDue - 14 - (i % 7)),
      dueAt: shiftDays(REFERENCE_TODAY, daysToDue),
      daysToDue,
    };
  });
}

export const ORDERS_SEED: readonly Order[] = buildSeed();
