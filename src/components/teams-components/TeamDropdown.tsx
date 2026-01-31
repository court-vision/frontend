import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectGroup,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandItem,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandSeparator,
} from "@/components/ui/command";
import { useTeamsQuery } from "@/hooks/useTeams";
import { useUIStore } from "@/stores/useUIStore";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamDropdown() {
  const { data: teams = [], isLoading } = useTeamsQuery();
  const { selectedTeam, setSelectedTeam } = useUIStore();
  const [selectedTeamName, setSelectedTeamName] = useState("Select Team");

  // Update selected team name when teams or selectedTeam changes
  useEffect(() => {
    if (teams && teams.length > 0 && selectedTeam) {
      const team = teams.find((team) => team.team_id === selectedTeam);
      if (team && team.league_info) {
        setSelectedTeamName(team.league_info.team_name);
      }
    } else if (!teams || teams.length === 0) {
      setSelectedTeamName("No Teams");
    } else {
      setSelectedTeamName("Select Team");
    }
  }, [teams, selectedTeam]);

  // Auto-select first team if none selected
  useEffect(() => {
    if (teams && teams.length > 0 && !selectedTeam) {
      setSelectedTeam(teams[0].team_id);
    }
  }, [teams, selectedTeam, setSelectedTeam]);

  const handleManageTeamsClick = () => {
    // This will be handled by navigation
  };

  if (isLoading) {
    return <Skeleton className="w-[190px] h-10" />;
  }

  return (
    <>
      <Select>
        <SelectTrigger className="w-[190px] text-xs hover:border-primary">
          <SelectValue
            placeholder={
              <span className="text-foreground">{selectedTeamName}</span>
            }
          />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <Command className="w-[180px]">
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup
                  className="font-gray-400 font-medium"
                  heading="Options"
                >
                  <Link href="/manage-teams">
                    <CommandItem onSelect={handleManageTeamsClick}>
                      Manage Teams
                    </CommandItem>
                  </Link>
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup
                  className="font-gray-400 font-medium"
                  heading="Teams"
                >
                  {teams &&
                    teams.map((team) => (
                      <CommandItem
                        key={team.team_id}
                        onSelect={() => setSelectedTeam(team.team_id)}
                        value={team.league_info?.team_name || "Unknown Team"}
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full mr-2 flex-shrink-0",
                            team.league_info?.provider === "yahoo"
                              ? "bg-purple-500"
                              : "bg-orange-500"
                          )}
                        />
                        {team.league_info?.team_name || "Unknown Team"}
                        {selectedTeam === team.team_id && (
                          <Check size={20} className="ml-2" />
                        )}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}
