import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary.tsx'

describe('ErrorBoundary', () => {
  it('turns a render error into state, and the state into a way out instead of a blank page', () => {
    expect(ErrorBoundary.getDerivedStateFromError(new Error('boom')).error?.message).toBe('boom')
    const b = new ErrorBoundary({ children: null })
    b.state = { error: new Error('Cannot read properties of undefined') }
    const html = renderToStaticMarkup(b.render())
    expect(html).toContain('This screen hit a problem')
    expect(html).toContain('Cannot read properties of undefined')
    expect(html).toContain('Reload')
    expect(html).toContain('Reset settings')
  })

  it('shows the screen when nothing went wrong', () => {
    const b = new ErrorBoundary({ children: 'the screen' })
    expect(b.render()).toBe('the screen')
  })
})
