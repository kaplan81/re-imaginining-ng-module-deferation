export enum RoastLevel {
  light,
  medium,
  mediumDark,
  dark,
}

export type RoastLevelET = keyof typeof RoastLevel;

export const roastLevels: readonly RoastLevelET[] = ['light', 'medium', 'mediumDark', 'dark'];

export const roastLevelLabels: Readonly<Record<RoastLevelET, string>> = {
  light: 'Light',
  medium: 'Medium',
  mediumDark: 'Medium-dark',
  dark: 'Dark',
};
