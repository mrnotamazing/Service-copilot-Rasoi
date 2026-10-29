// If a screen fails while drawing, show what happened and a way out, instead of a blank page.

import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Mascot } from '../brand/marks.tsx'
import { Button } from '@/components/ui/button'
import { STANDALONE } from '../lib/live.ts'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('TableMate screen failed', error, info.componentStack)
  }

  /** Clears this device's saved settings (language, text size…), the usual cause of a screen that won't open after an update. */
  private reset = () => {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('tablemate')) localStorage.removeItem(k)
    } catch {
      // storage blocked: nothing to clear
    }
    location.assign(STANDALONE ? location.pathname + '#/' : '/')
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
        <div className="w-full max-w-lg text-center">
          <Mascot className="mx-auto w-40" speed="var(--muted-foreground)" />
          <h1 className="mt-6 font-display text-3xl">This screen hit a problem</h1>
          <p className="mt-2 text-muted-foreground">Nothing you did has been lost. Try reloading. If it keeps happening, reset this device’s settings, or restart the app and refresh.</p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-xl border bg-muted p-3 text-left text-xs text-muted-foreground whitespace-pre-wrap">{String(error.message || error).slice(0, 600)}</pre>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button className="rounded-full" onClick={() => location.reload()}>
              Reload
            </Button>
            <Button variant="outline" className="rounded-full" onClick={this.reset}>
              Reset settings and go to the start
            </Button>
          </div>
        </div>
      </div>
    )
  }
}
