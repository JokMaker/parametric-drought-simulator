// Eastern Province, Season A maize (proposal §1.5).
export const DISTRICTS = [
  "Bugesera",
  "Gatsibo",
  "Kayonza",
  "Kirehe",
  "Ngoma",
  "Nyagatare",
  "Rwamagana",
] as const;

// Season A is named by its harvest year. Its critical Oct–Dec rains fall in the
// previous calendar year (the "window year" used by the history data).
export const FIRST_SEASON = 2001;
export const LAST_SEASON = 2025;
export const SEASONS = Array.from(
  { length: LAST_SEASON - FIRST_SEASON + 1 },
  (_, i) => FIRST_SEASON + i,
);
export const windowYearOf = (season: number) => season - 1;

// Seasons with NISR yield records used by the model. 2024 is rebuilt from the raw
// Production and Screening files (notebook Section 6b); 2018-2021 come from older
// releases (Section 6c). 2017 has yields too, but NISR imputed most of them, so it is
// not used.
export const YIELD_SEASONS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
export const YIELD_RANGE = `${YIELD_SEASONS[0]}–${YIELD_SEASONS[YIELD_SEASONS.length - 1]}`;

// How a poor harvest is defined, in words shared by every card.
export const POOR_RULE = (threshold: number) =>
  `A harvest ${Math.abs(threshold)}% or more below the district's expected yield (its own level and the province trend) counts as poor.`;

// Rwanda's most severe droughts, especially in Eastern Province
// (Niyonsenga et al., 2024): 2003–2006 and 2013–2017, as window years.
export const DROUGHT_YEARS = [2003, 2004, 2005, 2006, 2013, 2014, 2015, 2016, 2017];
export const isDroughtSeason = (season: number) => DROUGHT_YEARS.includes(windowYearOf(season));

// The USSD code farmers dial: the Africa's Talking sandbox channel on the shared
// *384# code. A live scheme would use a code allocated through the operators.
export const USSD_CODE = process.env.NEXT_PUBLIC_USSD_CODE ?? "*384*44698#";
