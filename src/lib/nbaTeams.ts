export interface NBATeamInfo {
  abbrev: string;
  name: string;
  conference: "East" | "West";
  division: string;
  /** The NBA's own team id (nba_api's `TEAM_ID`), which names the logo on cdn.nba.com. */
  nbaId: number;
}

export const NBA_TEAMS: NBATeamInfo[] = [
  // Eastern Conference - Atlantic
  { abbrev: "BOS", name: "Boston Celtics", conference: "East", division: "Atlantic", nbaId: 1610612738 },
  { abbrev: "BKN", name: "Brooklyn Nets", conference: "East", division: "Atlantic", nbaId: 1610612751 },
  { abbrev: "NYK", name: "New York Knicks", conference: "East", division: "Atlantic", nbaId: 1610612752 },
  { abbrev: "PHI", name: "Philadelphia 76ers", conference: "East", division: "Atlantic", nbaId: 1610612755 },
  { abbrev: "TOR", name: "Toronto Raptors", conference: "East", division: "Atlantic", nbaId: 1610612761 },
  // Eastern Conference - Central
  { abbrev: "CHI", name: "Chicago Bulls", conference: "East", division: "Central", nbaId: 1610612741 },
  { abbrev: "CLE", name: "Cleveland Cavaliers", conference: "East", division: "Central", nbaId: 1610612739 },
  { abbrev: "DET", name: "Detroit Pistons", conference: "East", division: "Central", nbaId: 1610612765 },
  { abbrev: "IND", name: "Indiana Pacers", conference: "East", division: "Central", nbaId: 1610612754 },
  { abbrev: "MIL", name: "Milwaukee Bucks", conference: "East", division: "Central", nbaId: 1610612749 },
  // Eastern Conference - Southeast
  { abbrev: "ATL", name: "Atlanta Hawks", conference: "East", division: "Southeast", nbaId: 1610612737 },
  { abbrev: "CHA", name: "Charlotte Hornets", conference: "East", division: "Southeast", nbaId: 1610612766 },
  { abbrev: "MIA", name: "Miami Heat", conference: "East", division: "Southeast", nbaId: 1610612748 },
  { abbrev: "ORL", name: "Orlando Magic", conference: "East", division: "Southeast", nbaId: 1610612753 },
  { abbrev: "WAS", name: "Washington Wizards", conference: "East", division: "Southeast", nbaId: 1610612764 },
  // Western Conference - Northwest
  { abbrev: "DEN", name: "Denver Nuggets", conference: "West", division: "Northwest", nbaId: 1610612743 },
  { abbrev: "MIN", name: "Minnesota Timberwolves", conference: "West", division: "Northwest", nbaId: 1610612750 },
  { abbrev: "OKC", name: "Oklahoma City Thunder", conference: "West", division: "Northwest", nbaId: 1610612760 },
  { abbrev: "POR", name: "Portland Trail Blazers", conference: "West", division: "Northwest", nbaId: 1610612757 },
  { abbrev: "UTA", name: "Utah Jazz", conference: "West", division: "Northwest", nbaId: 1610612762 },
  // Western Conference - Pacific
  { abbrev: "GSW", name: "Golden State Warriors", conference: "West", division: "Pacific", nbaId: 1610612744 },
  { abbrev: "LAC", name: "Los Angeles Clippers", conference: "West", division: "Pacific", nbaId: 1610612746 },
  { abbrev: "LAL", name: "Los Angeles Lakers", conference: "West", division: "Pacific", nbaId: 1610612747 },
  { abbrev: "PHX", name: "Phoenix Suns", conference: "West", division: "Pacific", nbaId: 1610612756 },
  { abbrev: "SAC", name: "Sacramento Kings", conference: "West", division: "Pacific", nbaId: 1610612758 },
  // Western Conference - Southwest
  { abbrev: "DAL", name: "Dallas Mavericks", conference: "West", division: "Southwest", nbaId: 1610612742 },
  { abbrev: "HOU", name: "Houston Rockets", conference: "West", division: "Southwest", nbaId: 1610612745 },
  { abbrev: "MEM", name: "Memphis Grizzlies", conference: "West", division: "Southwest", nbaId: 1610612763 },
  { abbrev: "NOP", name: "New Orleans Pelicans", conference: "West", division: "Southwest", nbaId: 1610612740 },
  { abbrev: "SAS", name: "San Antonio Spurs", conference: "West", division: "Southwest", nbaId: 1610612759 },
];

export const NBA_TEAM_BY_ABBREV: Record<string, NBATeamInfo> = Object.fromEntries(
  NBA_TEAMS.map((t) => [t.abbrev, t])
);

/** "https://cdn.nba.com/logos/nba/1610612743/primary/D/logo.svg": the team's logo for a dark or light ground. */
export function teamLogoUrl(abbrev: string, ground: "dark" | "light" = "dark"): string | null {
  const t = NBA_TEAM_BY_ABBREV[abbrev.toUpperCase()];
  if (!t) return null;
  return `https://cdn.nba.com/logos/nba/${t.nbaId}/primary/${ground === "dark" ? "D" : "L"}/logo.svg`;
}
