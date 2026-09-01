export enum RoastLevel {
  light,
  medium,
  mediumDark,
  dark,
}

export type RoastLevelET = keyof typeof RoastLevel;

export const ROAST_LEVELS: readonly RoastLevelET[] = ['light', 'medium', 'mediumDark', 'dark'];

export const ROAST_LEVEL_LABELS: Readonly<Record<RoastLevelET, string>> = {
  light: 'Light',
  medium: 'Medium',
  mediumDark: 'Medium-dark',
  dark: 'Dark',
};
