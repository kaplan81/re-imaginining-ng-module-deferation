export enum CoffeeProcess {
  washed,
  natural,
  honey,
  anaerobic,
}

export type CoffeeProcessET = keyof typeof CoffeeProcess;

export const COFFEE_PROCESS_LABELS: Readonly<Record<CoffeeProcessET, string>> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
};
