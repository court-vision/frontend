"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useUser, useClerk } from "@clerk/nextjs";
import {
  Home,
  Trophy,
  Users,
  Calendar,
  Settings,
  Zap,
  Check,
  UserCircle,
  Sun,
  Moon,
  LogIn,
  LogOut,
  CalendarCheck,
  User,
  UserPlus,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { useTeams } from "@/app/context/TeamsContext";

// =============================================================================
// Types
// =============================================================================

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  shortcut?: string;
  group: string;
  action: () => void | Promise<void>;
  keywords?: string[]; // Additional search keywords
}

interface CommandPaletteContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  registerCommand: (command: Command) => void;
  unregisterCommand: (commandId: string) => void;
}

// =============================================================================
// Context
// =============================================================================

const CommandPaletteContext = createContext<CommandPaletteContextType | null>(null);

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within a CommandPaletteProvider");
  }
  return context;
}

// =============================================================================
// Provider
// =============================================================================

interface CommandPaletteProviderProps {
  children: ReactNode;
}

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const [dynamicCommands, setDynamicCommands] = useState<Command[]>([]);
  const { teams, selectedTeam, setSelectedTeam } = useTeams();

  // ---------------------------------------------------------------------------
  // Navigation Commands (built-in)
  // ---------------------------------------------------------------------------

  const navigationCommands: Command[] = [
    {
      id: "nav-home",
      label: "Go to Home",
      description: "Navigate to the home page",
      icon: <Home className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["home", "dashboard", "main"],
      action: () => router.push("/"),
    },
    {
      id: "nav-your-teams",
      label: "Go to Your Teams",
      description: "Manage your fantasy teams",
      icon: <Users className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["teams", "my teams", "roster"],
      action: () => router.push("/your-teams"),
    },
    {
      id: "nav-lineup-generation",
      label: "Go to Lineup Generation",
      description: "Generate optimized lineups",
      icon: <Zap className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["generate", "lineup", "optimize", "auto"],
      action: () => router.push("/lineup-generation"),
    },
    {
      id: "nav-matchup",
      label: "Go to Matchup",
      description: "View the matchup for the week",
      icon: <CalendarCheck className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["matchup", "schedule", "week"],
      action: () => router.push("/matchup"),
    },
    {
      id: "nav-streamers",
      label: "Go to Streamers",
      description: "View the streamers for the week",
      icon: <UserPlus className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["streamers", "stream", "week"],
      action: () => router.push("/streamers"),
    },
    {
      id: "nav-rankings",
      label: "Go to Rankings",
      description: "View player rankings and stats",
      icon: <Trophy className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["rankings", "leaderboard", "players"],
      action: () => router.push("/rankings"),
    },
    {
      id: "nav-account",
      label: "Go to Account",
      description: "View your account information",
      icon: <User className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["account", "profile", "settings"],
      action: () => router.push("/account"),
    },
    {
      id: "nav-manage-teams",
      label: "Go to Manage Teams",
      description: "Add or edit team configurations",
      icon: <Settings className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["manage", "teams", "settings", "configure"],
      action: () => router.push("/manage-teams"),
    },
    {
      id: "nav-manage-lineups",
      label: "Go to Manage Lineups",
      description: "Configure your lineup settings",
      icon: <Calendar className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["lineups", "manage", "schedule"],
      action: () => router.push("/manage-lineups"),
    },
  ];

  // ---------------------------------------------------------------------------
  // Team Switching Commands (dynamic based on user's teams)
  // ---------------------------------------------------------------------------

  const teamCommands: Command[] = useMemo(() => {
    if (!teams || teams.length === 0) return [];

    return teams.map((team) => {
      const isSelected = selectedTeam === team.team_id;
      const teamName = team.league_info?.team_name || team.team_info?.team_name || "Unknown Team";
      const leagueName = team.league_info?.league_name || team.team_info?.league_name || "";

      return {
        id: `team-${team.team_id}`,
        label: teamName,
        description: leagueName ? `${leagueName}` : undefined,
        icon: isSelected ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <UserCircle className="h-4 w-4" />
        ),
        group: "Switch Team",
        keywords: ["team", "switch", teamName.toLowerCase(), leagueName?.toLowerCase() || ""],
        action: () => {
          setSelectedTeam(team.team_id);
        },
      };
    });
  }, [teams, selectedTeam, setSelectedTeam]);

  // ---------------------------------------------------------------------------
  // Theme Commands
  // ---------------------------------------------------------------------------

  const themeCommands: Command[] = [
    {
      id: "theme-light",
      label: "Light Mode",
      description: "Switch to light theme",
      icon: theme === "light" ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Sun className="h-4 w-4" />
      ),
      group: "Theme",
      keywords: ["theme", "light", "bright", "day"],
      action: () => setTheme("light"),
    },
    {
      id: "theme-dark",
      label: "Dark Mode",
      description: "Switch to dark theme",
      icon: theme === "dark" ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <Moon className="h-4 w-4" />
      ),
      group: "Theme",
      keywords: ["theme", "dark", "night"],
      action: () => setTheme("dark"),
    },
  ];

  // ---------------------------------------------------------------------------
  // Auth Commands
  // ---------------------------------------------------------------------------

  const authCommands: Command[] = isSignedIn
    ? [
        {
          id: "auth-logout",
          label: "Sign Out",
          description: "Sign out of your account",
          icon: <LogOut className="h-4 w-4" />,
          group: "Account",
          keywords: ["logout", "sign out", "exit", "account"],
          action: () => signOut({ redirectUrl: "/" }),
        },
      ]
    : [
        {
          id: "auth-login",
          label: "Sign In",
          description: "Sign in to your account",
          icon: <LogIn className="h-4 w-4" />,
          group: "Account",
          keywords: ["login", "sign in", "account"],
          action: () => router.push("/sign-in"),
        },
      ];

  // Combine built-in and dynamic commands
  const allCommands = [...navigationCommands, ...teamCommands, ...themeCommands, ...authCommands, ...dynamicCommands];

  // Group commands by their group property
  const groupedCommands = allCommands.reduce((acc, command) => {
    if (!acc[command.group]) {
      acc[command.group] = [];
    }
    acc[command.group].push(command);
    return acc;
  }, {} as Record<string, Command[]>);

  // ---------------------------------------------------------------------------
  // Context API
  // ---------------------------------------------------------------------------

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  const registerCommand = useCallback((command: Command) => {
    setDynamicCommands((prev) => {
      // Prevent duplicates
      if (prev.some((c) => c.id === command.id)) {
        return prev.map((c) => (c.id === command.id ? command : c));
      }
      return [...prev, command];
    });
  }, []);

  const unregisterCommand = useCallback((commandId: string) => {
    setDynamicCommands((prev) => prev.filter((c) => c.id !== commandId));
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard Shortcut (Cmd/Ctrl + K)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        toggle();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle]);

  // ---------------------------------------------------------------------------
  // Command Execution
  // ---------------------------------------------------------------------------

  const handleSelect = (command: Command) => {
    close();
    command.action();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <CommandPaletteContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        registerCommand,
        unregisterCommand,
      }}
    >
      {children}

      <CommandDialog open={isOpen} onOpenChange={setIsOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No commands found.</CommandEmpty>
          {Object.entries(groupedCommands).map(([group, commands]) => (
            <CommandGroup key={group} heading={group}>
              {commands.map((command) => (
                <CommandItem
                  key={command.id}
                  onSelect={() => handleSelect(command)}
                  className="cursor-pointer"
                  keywords={command.keywords}
                >
                  {command.icon && (
                    <span className="mr-2 text-muted-foreground">{command.icon}</span>
                  )}
                  <div className="flex flex-col">
                    <span>{command.label}</span>
                    {command.description && (
                      <span className="text-xs text-muted-foreground">
                        {command.description}
                      </span>
                    )}
                  </div>
                  {command.shortcut && (
                    <CommandShortcut>{command.shortcut}</CommandShortcut>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}
