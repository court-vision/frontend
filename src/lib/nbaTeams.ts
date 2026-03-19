export interface NBATeamInfo {
  abbrev: string;
  name: string;
  conference: "East" | "West";
  division: string;
}

export const NBA_TEAMS: NBATeamInfo[] = [
  // Eastern Conference - Atlantic
  { abbrev: "BOS", name: "Boston Celtics", conference: "East", division: "Atlantic" },
  { abbrev: "BKN", name: "Brooklyn Nets", conference: "East", division: "Atlantic" },
  { abbrev: "NYK", name: "New York Knicks", conference: "East", division: "Atlantic" },
  { abbrev: "PHI", name: "Philadelphia 76ers", conference: "East", division: "Atlantic" },
  { abbrev: "TOR", name: "Toronto Raptors", conference: "East", division: "Atlantic" },
  // Eastern Conference - Central
  { abbrev: "CHI", name: "Chicago Bulls", conference: "East", division: "Central" },
  { abbrev: "CLE", name: "Cleveland Cavaliers", conference: "East", division: "Central" },
  { abbrev: "DET", name: "Detroit Pistons", conference: "East", division: "Central" },
  { abbrev: "IND", name: "Indiana Pacers", conference: "East", division: "Central" },
  { abbrev: "MIL", name: "Milwaukee Bucks", conference: "East", division: "Central" },
  // Eastern Conference - Southeast
  { abbrev: "ATL", name: "Atlanta Hawks", conference: "East", division: "Southeast" },
  { abbrev: "CHA", name: "Charlotte Hornets", conference: "East", division: "Southeast" },
  { abbrev: "MIA", name: "Miami Heat", conference: "East", division: "Southeast" },
  { abbrev: "ORL", name: "Orlando Magic", conference: "East", division: "Southeast" },
  { abbrev: "WAS", name: "Washington Wizards", conference: "East", division: "Southeast" },
  // Western Conference - Northwest
  { abbrev: "DEN", name: "Denver Nuggets", conference: "West", division: "Northwest" },
  { abbrev: "MIN", name: "Minnesota Timberwolves", conference: "West", division: "Northwest" },
  { abbrev: "OKC", name: "Oklahoma City Thunder", conference: "West", division: "Northwest" },
  { abbrev: "POR", name: "Portland Trail Blazers", conference: "West", division: "Northwest" },
  { abbrev: "UTA", name: "Utah Jazz", conference: "West", division: "Northwest" },
  // Western Conference - Pacific
  { abbrev: "GSW", name: "Golden State Warriors", conference: "West", division: "Pacific" },
  { abbrev: "LAC", name: "Los Angeles Clippers", conference: "West", division: "Pacific" },
  { abbrev: "LAL", name: "Los Angeles Lakers", conference: "West", division: "Pacific" },
  { abbrev: "PHX", name: "Phoenix Suns", conference: "West", division: "Pacific" },
  { abbrev: "SAC", name: "Sacramento Kings", conference: "West", division: "Pacific" },
  // Western Conference - Southwest
  { abbrev: "DAL", name: "Dallas Mavericks", conference: "West", division: "Southwest" },
  { abbrev: "HOU", name: "Houston Rockets", conference: "West", division: "Southwest" },
  { abbrev: "MEM", name: "Memphis Grizzlies", conference: "West", division: "Southwest" },
  { abbrev: "NOP", name: "New Orleans Pelicans", conference: "West", division: "Southwest" },
  { abbrev: "SAS", name: "San Antonio Spurs", conference: "West", division: "Southwest" },
];

export const NBA_TEAM_BY_ABBREV: Record<string, NBATeamInfo> = Object.fromEntries(
  NBA_TEAMS.map((t) => [t.abbrev, t])
);
