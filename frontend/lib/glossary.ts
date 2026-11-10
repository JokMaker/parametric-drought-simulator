// One-sentence, plain-language meanings for the terms user testers found hard
// ("index", "trigger", "basis risk"...). Shown by the ⓘ next to a term.

export const GLOSSARY = {
  index: {
    term: "Index",
    text: "The change in maize yield the model predicts from rainfall and crop greenness. -10% means a harvest about 10% below normal for the district.",
  },
  ndvi: {
    term: "Crop greenness (NDVI)",
    text: "How green the cropland looks from satellite. Greener than normal usually means healthy crops; browner means stress, often from drought.",
  },
  sd: {
    term: "SD from normal",
    text: "How unusual the season was against the district's own record since 2001. About 1 SD drier or browner happens one season in six; 2 SD is rare.",
  },
  payoutRule: {
    term: "Trigger and exit",
    text: "Nothing is paid while the index is above -2% (the trigger). Below it the payout rises in a straight line, up to the full cover at -22% (the exit).",
  },
  cover: {
    term: "Cover",
    text: "The most the policy can pay in one season: 22% of what the maize is expected to be worth, so a full payout roughly replaces a severe loss.",
  },
  poorHarvest: {
    term: "Poor harvest",
    text: "A harvest 10% or more below the expected level for that district and year, from the NISR survey.",
  },
  falsePayout: {
    term: "False payout",
    text: "The index paid in a season when the real harvest was normal (less than 10% below expected).",
  },
  basisRisk: {
    term: "Basis risk",
    text: "How far the index payout was from what the real harvest called for. 0% means it paid exactly right; 100% means it was completely wrong.",
  },
  loo: {
    term: "Leave-one-out",
    text: "The model is fitted without one district-season and then tested on it, once for each of the 56. It shows how the model does on data it has not seen.",
  },
  loso: {
    term: "Leave-one-season-out",
    text: "All seven districts of one season are held out together, so the model is tested on a whole year it has not seen, as an insurer would be.",
  },
  r2: {
    term: "R²",
    text: "The share of the ups and downs in yield the model explains. 0 is no better than always guessing the average; below 0 is worse.",
  },
  rmse: {
    term: "RMSE and MAE",
    text: "The typical size of the model's error, in percentage points of yield. Lower is better.",
  },
} as const;

export type GlossaryKey = keyof typeof GLOSSARY;
