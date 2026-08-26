"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

interface PanelErrorBoundaryProps {
  children: ReactNode;
  name?: string;
}

interface PanelErrorBoundaryState {
  error: Error | null;
}

// Keeps a single crashing panel from unmounting the whole terminal layout.
export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  state: PanelErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Panel "${this.props.name ?? "unknown"}" crashed`, error, info.componentStack);
    Sentry.captureException(error, {
      tags: { panel: this.props.name ?? "unknown" },
      contexts: { react: { componentStack: info.componentStack } },
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <span className="text-sm font-medium">This panel crashed</span>
          <span className="max-w-xs font-mono text-xs text-muted-foreground">
            {this.state.error.message}
          </span>
          <button
            type="button"
            onClick={this.reset}
            className="mt-1 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-muted"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
