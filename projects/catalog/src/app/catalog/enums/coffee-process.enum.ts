export enum CoffeeProcess {
  washed,
  natural,
  honey,
  anaerobic,
}

export type CoffeeProcessET = keyof typeof CoffeeProcess;

export const coffeeProcessLabels: Readonly<Record<CoffeeProcessET, string>> = {
  washed: 'Washed',
  natural: 'Natural',
  honey: 'Honey',
  anaerobic: 'Anaerobic',
};
