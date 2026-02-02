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
  Terminal,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { Command as CommandIcon } from "lucide-react";
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
      id: "nav-terminal",
      label: "Go to Terminal",
      description: "Open the terminal",
      icon: <Terminal className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["terminal", "command bar", "search"],
      action: () => router.push("/terminal"),
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
  // Keyboard Shortcuts
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Cmd/Ctrl shortcuts (letters only - avoid numbers due to Safari tab switching)
    const cmdShortcuts: Record<string, () => void> = {
      k: () => toggle(),
      g: () => router.push("/lineup-generation"),
      s: () => router.push("/streamers"),
      r: () => router.push("/rankings"),
      m: () => router.push("/matchup"),
      t: () => router.push("/your-teams"),
    };

    // Option/Alt + number shortcuts (safe from browser conflicts)
    // Use e.code (physical key) instead of e.key because macOS transforms
    // Option+number into special characters (e.g., Option+1 = ¡)
    const altShortcuts: Record<string, () => void> = {
      Digit1: () => router.push("/"),
      Digit2: () => router.push("/your-teams"),
      Digit3: () => router.push("/lineup-generation"),
      Digit4: () => router.push("/matchup"),
      Digit5: () => router.push("/streamers"),
      Digit6: () => router.push("/rankings"),
      Digit7: () => router.push("/terminal"),
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Only allow command palette shortcut in inputs
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          toggle();
        }
        return;
      }

      // Handle Cmd/Ctrl shortcuts (letters)
      if (e.metaKey || e.ctrlKey) {
        const handler = cmdShortcuts[e.key.toLowerCase()];
        if (handler) {
          e.preventDefault();
          close();
          handler();
        }
      }

      // Handle Option/Alt shortcuts (numbers)
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const handler = altShortcuts[e.code];
        if (handler) {
          e.preventDefault();
          close();
          handler();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [toggle, close, router]);

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
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
          <CommandIcon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Court Vision</span>
        </div>

        <CommandInput placeholder="Type a command or search..." className="border-0" />

        <CommandList className="max-h-[400px]">
          <CommandEmpty>No commands found.</CommandEmpty>
          {Object.entries(groupedCommands).map(([group, commands], index) => (
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
                  <div className="flex flex-col flex-1">
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

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-4">
            <span><kbd className="px-1 py-0.5 rounded bg-muted">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted">↵</kbd> select</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted">esc</kbd> close</span>
          </div>
          <span className="text-muted-foreground/70">⌥1-6 for pages</span>
        </div>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}
