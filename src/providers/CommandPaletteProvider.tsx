"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Trophy,
  Users,
  Calendar,
  Settings,
  Zap,
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
  const [isOpen, setIsOpen] = useState(false);
  const [dynamicCommands, setDynamicCommands] = useState<Command[]>([]);

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
      id: "nav-standings",
      label: "Go to Standings",
      description: "View player rankings and stats",
      icon: <Trophy className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["standings", "rankings", "leaderboard", "players"],
      action: () => router.push("/standings"),
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
    {
      id: "nav-lineup-generation",
      label: "Go to Lineup Generation",
      description: "Generate optimized lineups",
      icon: <Zap className="h-4 w-4" />,
      group: "Navigation",
      keywords: ["generate", "lineup", "optimize", "auto"],
      action: () => router.push("/lineup-generation"),
    },
  ];

  // Combine built-in and dynamic commands
  const allCommands = [...navigationCommands, ...dynamicCommands];

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
