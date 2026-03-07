"use client";

import { useState } from "react";
import { Key, BookOpen, ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiKeyManager } from "@/components/developer/ApiKeyManager";
import { ApiDocs } from "@/components/developer/ApiDocs";
import { ApiPlayground } from "@/components/developer/ApiPlayground";
import type { Endpoint } from "@/components/developer/api-data";

const developerTabs = [
  {
    id: "api-keys",
    label: "API Keys",
    icon: Key,
    description: "Manage keys",
  },
  {
    id: "documentation",
    label: "Documentation",
    icon: BookOpen,
    description: "API reference",
  },
  {
    id: "playground",
    label: "Playground",
    icon: Zap,
    description: "Try the API",
  },
] as const;

type TabId = (typeof developerTabs)[number]["id"];

export default function Developer() {
  const [activeTab, setActiveTab] = useState<TabId>("api-keys");
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState<Endpoint | undefined>(undefined);

  const handleTabChange = (tabId: TabId) => {
    if (typeof window !== "undefined" && window.location.hash.startsWith("#section-")) {
      const nextUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", nextUrl);
    }
    setActiveTab(tabId);
  };

  const handleTryInPlayground = (endpoint: Endpoint) => {
    setPlaygroundEndpoint(endpoint);
    setActiveTab("playground");
  };

  const renderTabContent = (tabId: TabId) => {
    switch (tabId) {
      case "api-keys":
        return <ApiKeyManager />;
      case "documentation":
        return <ApiDocs onTryInPlayground={handleTryInPlayground} />;
      case "playground":
        return <ApiPlayground initialEndpoint={playgroundEndpoint} />;
    }
  };

  return (
    <div className="space-y-4 animate-slide-up-fade">
      {/* Page header */}
      <section>
        <h1 className="font-display text-xl font-bold tracking-tight">Developer</h1>
        <p className="text-muted-foreground text-xs mt-0.5">
          Manage API keys and explore the Court Vision API.
        </p>
      </section>

      {/* Mobile: accordion */}
      <div className="md:hidden space-y-1.5">
        {developerTabs.map((tab) => {
          const Icon = tab.icon;
          const isOpen = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              className={cn(
                "rounded-md border transition-colors duration-150",
                isOpen ? "border-primary/20 bg-card/80" : "border-border bg-card/50"
              )}
            >
              <button
                onClick={() => handleTabChange(tab.id)}
                className="w-full flex items-center justify-between gap-2.5 px-3 py-2.5 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-md flex items-center justify-center shrink-0 transition-colors duration-150",
                      isOpen ? "bg-primary/15 border border-primary/20" : "bg-muted border border-transparent"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-3.5 w-3.5 transition-colors duration-150",
                        isOpen ? "text-primary" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div>
                    <p className={cn("text-xs font-medium leading-none", isOpen ? "text-primary" : "text-foreground")}>
                      {tab.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{tab.description}</p>
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>
              {isOpen && (
                <div className="px-3 pb-3">
                  {renderTabContent(tab.id)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: sidebar + panel */}
      <div className="hidden md:flex gap-5 items-start">
        {/* Sidebar */}
        <nav className="shrink-0 w-44 space-y-0.5 sticky top-4 self-start">
          {developerTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-all duration-150",
                  "text-xs font-medium",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="leading-none">{tab.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                    {tab.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className={cn(
          "flex-1 min-w-0",
          activeTab === "api-keys" && "max-w-3xl",
        )}>
          {renderTabContent(activeTab)}
        </div>
      </div>
    </div>
  );
}
