export const REGION_CODES = [
  "georgia",
  "tbilisi",
  "abkhazia",
  "adjara",
  "guria",
  "imereti",
  "kakheti",
  "kvemo-kartli",
  "mtskheta-mtianeti",
  "racha-lechkhumi",
  "samegrelo",
  "samtskhe-javakheti",
  "shida-kartli",
] as const;

export type RegionCode = (typeof REGION_CODES)[number];
