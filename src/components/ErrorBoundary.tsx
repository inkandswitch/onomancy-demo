import { Component, type ReactNode } from "react";
import { errorMessage, log } from "../log";

/**
 * Catches render-time errors from the document pane.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    log.error("Caught error while rendering a document:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full flex items-center justify-center bg-muted p-8">
          <div className="max-w-md text-center">
            <p className="text-foreground font-medium mb-2">
              This document could not be displayed
            </p>
            <p className="text-sm text-muted-foreground">
              {errorMessage(this.state.error)}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
