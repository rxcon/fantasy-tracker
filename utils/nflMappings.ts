// ESPN's fantasy API returns numeric IDs instead of readable names for
// almost everything. These tables translate the ones we need to show a
// player breakdown. ESPN doesn't publish these officially — this is the
// mapping the fantasy football developer community has reverse-engineered
// and it's been stable for years, but if ESPN ever restructures their API
// this is the first place to check.

export const ESPN_PRO_TEAM: Record<number, string> = {
  1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN",
  8: "DET", 9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR",
  15: "MIA", 16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ",
  21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC", 25: "SF", 26: "SEA",
  27: "TB", 28: "WSH", 29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU",
};

export const ESPN_POSITION: Record<number, string> = {
  1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "D/ST",
};

// lineupSlotId tells us where a player sits in the actual starting
// lineup (vs. bench/IR). We use it both to label the slot and to sort
// starters into a sensible order.
export const ESPN_LINEUP_SLOT: Record<number, string> = {
  0: "QB", 2: "RB", 4: "WR", 6: "TE", 7: "OP", 16: "D/ST", 17: "K",
  20: "Bench", 21: "IR", 23: "FLEX",
};

export const ESPN_SLOT_SORT_ORDER: Record<number, number> = {
  0: 1, 2: 2, 4: 3, 6: 4, 23: 5, 7: 5, 16: 6, 17: 7, 20: 8, 21: 9,
};

const SLEEPER_POSITION_SORT_ORDER: Record<string, number> = {
  QB: 1, RB: 2, WR: 3, TE: 4, K: 5, DEF: 6,
};

export function sleeperPositionSortValue(position: string | undefined): number {
  return SLEEPER_POSITION_SORT_ORDER[position ?? ""] ?? 9;
}
