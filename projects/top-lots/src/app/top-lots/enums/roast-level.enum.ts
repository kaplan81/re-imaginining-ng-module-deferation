/**
 * This microfrontend's own roast vocabulary. It is not imported from the catalog
 * application - no file here may reference `projects/catalog`, not even a type -
 * so the two agree by convention and a published contracts package is what would
 * make them agree by construction.
 */
export enum RoastLevel {
  light,
  medium,
  mediumDark,
  dark,
}

export type RoastLevelET = keyof typeof RoastLevel;

export const roastLevelLabels: Readonly<Record<RoastLevelET, string>> = {
  light: 'Light',
  medium: 'Medium',
  mediumDark: 'Medium-dark',
  dark: 'Dark',
};
