"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { Check, UserCircle, LogIn, LogOut } from "lucide-react";
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
import { DialogClose } from "@/components/ui/dialog";
import { Command as CommandIcon, X } from "lucide-react";
import { useTeams } from "@/app/context/TeamsContext";
import { useIsBelowLg } from "@/hooks/useBreakpoint";
import {
  ALT_RANGE_LABEL,
  ALT_SHORTCUTS,
  CMD_SHORTCUTS,
  PALETTE_NAV,
  paletteLabel,
  shortcutLabel,
} from "@/lib/navigation";

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
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [isOpen, setIsOpen] = useState(false);
  const [dynamicCommands, setDynamicCommands] = useState<Command[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const belowLg = useIsBelowLg();

  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [isOpen]);
  const { teams, selectedTeam, setSelectedTeam } = useTeams();

  // ---------------------------------------------------------------------------
  // Navigation Commands (built-in)
  // ---------------------------------------------------------------------------

  // Desktop-only pages (terminal, SQL) show a notice below `lg`, so don't offer them there.
  const navigationCommands: Command[] = useMemo(
    () =>
      PALETTE_NAV.filter((item) => !(belowLg && item.desktopOnly)).map((item) => {
        const Icon = item.icon;
        return {
          id: `nav-${item.href === "/" ? "home" : item.href.slice(1)}`,
          label: `Go to ${paletteLabel(item)}`,
          description: item.description,
          icon: <Icon className="h-4 w-4" />,
          shortcut: shortcutLabel(item),
          group: "Navigation",
          keywords: item.keywords,
          action: () => router.push(item.href),
        };
      }),
    [router, belowLg]
  );

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

  // Theme commands removed - dark-only mode

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
  const allCommands = [...navigationCommands, ...teamCommands, ...authCommands, ...dynamicCommands];

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
    // and Option/Alt + digit shortcuts both come from src/lib/navigation.ts so
    // the handlers can never drift from the labels shown in the nav bar.
    // Alt uses e.code (physical key) because macOS transforms Option+digit in e.key.
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
        const key = e.key.toLowerCase();
        if (key === "k") {
          e.preventDefault();
          toggle();
          return;
        }
        const href = CMD_SHORTCUTS[key];
        if (href) {
          e.preventDefault();
          close();
          router.push(href);
        }
      }

      // Handle Option/Alt shortcuts (digits)
      if (e.altKey && !e.metaKey && !e.ctrlKey) {
        const href = ALT_SHORTCUTS[e.code];
        if (href) {
          e.preventDefault();
          close();
          router.push(href);
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
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <CommandIcon className="h-3.5 w-3.5 text-primary" />
            <span className="font-display text-xs font-semibold text-foreground/80 tracking-wide">Commands</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-muted-foreground/40">Esc to close</span>
            <DialogClose className="flex h-8 w-8 items-center justify-center -my-1.5 -mr-1.5 md:m-0 md:h-auto md:w-auto rounded-sm opacity-50 hover:opacity-100 transition-opacity touch-hit">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </div>
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary font-mono text-sm select-none pl-8">{">"}</span>
          <CommandInput ref={inputRef} placeholder="Type a command or search..." className="border-0 pl-5" />
        </div>

        <CommandList className="max-h-[min(400px,calc(100vh-14rem))] supports-[height:100dvh]:max-h-[min(400px,calc(100dvh-14rem))]">
          <CommandEmpty className="py-6 text-center text-xs font-mono text-muted-foreground/50">
            No commands found.
          </CommandEmpty>
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
                    <span className="text-xs">{command.label}</span>
                    {command.description && (
                      <span className="text-[10px] text-muted-foreground">
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

        {/* Footer (keyboard hints — pointless on phones) */}
        <div className="hidden sm:flex items-center justify-between px-3 py-1.5 border-t border-border bg-card text-[9px] text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded border border-border bg-muted/50">↑↓</kbd> navigate</span>
            <span><kbd className="px-1 py-0.5 rounded border border-border bg-muted/50">↵</kbd> select</span>
            <span><kbd className="px-1 py-0.5 rounded border border-border bg-muted/50">esc</kbd> close</span>
          </div>
          <span className="text-muted-foreground/50">{ALT_RANGE_LABEL} pages | ? shortcuts</span>
        </div>
      </CommandDialog>
    </CommandPaletteContext.Provider>
  );
}
