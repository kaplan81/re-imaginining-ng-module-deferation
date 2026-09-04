import type { QueuedOrder } from '../models/queued-order.model';

/**
 * This microfrontend's own backend data, deliberately not the orders
 * application's, so the numbers here do not match what `/orders` reports. That is
 * the honest consequence of an independently deployed microfrontend.
 *
 * `referenceToday` is a fixed date rather than `Date.now()`: a demo that shows
 * "6 days late" should show the same thing next month, and tests should not need
 * to freeze the clock.
 */
export const referenceToday = '2026-09-01';

interface QueueSeed {
  reference: string;
  customer: string;
  status: QueuedOrder['status'];
  quantityKg: number;
  daysToDue: number;
}

/**
 * Written out literally rather than generated from indices: at eight rows a
 * table is clearer than a formula and exactly as reproducible. Late and on-hold
 * rows come first once sorted by due date, which is what a roast queue should
 * open on.
 */
const seed: readonly QueueSeed[] = [
  {
    reference: 'RQ-4401',
    customer: 'Kaffeehaus Nord',
    status: 'onHold',
    quantityKg: 48,
    daysToDue: -9,
  },
  {
    reference: 'RQ-4402',
    customer: 'Le Petit Grain',
    status: 'roasting',
    quantityKg: 120,
    daysToDue: -4,
  },
  { reference: 'RQ-4403', customer: 'Bica & Co.', status: 'onHold', quantityKg: 36, daysToDue: -2 },
  {
    reference: 'RQ-4404',
    customer: 'Kraków Roast Club',
    status: 'intake',
    quantityKg: 90,
    daysToDue: 0,
  },
  {
    reference: 'RQ-4405',
    customer: 'Bräu & Bohne',
    status: 'roasting',
    quantityKg: 66,
    daysToDue: 2,
  },
  {
    reference: 'RQ-4406',
    customer: 'Nord Kaffebar',
    status: 'packed',
    quantityKg: 24,
    daysToDue: 4,
  },
  {
    reference: 'RQ-4407',
    customer: 'Trieste Torrefazione',
    status: 'intake',
    quantityKg: 150,
    daysToDue: 7,
  },
  {
    reference: 'RQ-4408',
    customer: 'Amsterdam Bean Bar',
    status: 'roasting',
    quantityKg: 72,
    daysToDue: 11,
  },
];

export const roastQueueSeed: readonly QueuedOrder[] = seed.map((entry, i) => ({
  id: `RQ-${4401 + i}`,
  reference: entry.reference,
  customer: entry.customer,
  status: entry.status,
  quantityKg: entry.quantityKg,
  dueAt: shiftDays(referenceToday, entry.daysToDue),
  daysToDue: entry.daysToDue,
}));

function shiftDays(from: string, days: number): string {
  const date = new Date(`${from}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}
