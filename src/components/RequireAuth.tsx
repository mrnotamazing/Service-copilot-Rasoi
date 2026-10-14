import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { homeOf, mayOpen, useSession } from '../lib/auth.ts'
import type { Role } from '../lib/role.ts'

type Page = 'server' | 'kitchen' | 'manager' | 'servers'

/** A page that belongs to one role: others are sent to sign in, or back to their own screen. */
export function RequireAuth({ page, children }: { page: Page; children: ReactNode }) {
  const session = useSession()
  const { staffId = '' } = useParams()
  const { pathname, search } = useLocation()
  const target: Role | { kind: 'servers' } = page === 'server' ? { kind: 'server', staffId } : page === 'kitchen' ? { kind: 'kitchen' } : page === 'manager' ? { kind: 'manager' } : { kind: 'servers' }
  const ok = mayOpen(session, target)
  const wrongPerson = !!session && !ok

  useEffect(() => {
    if (wrongPerson) toast.message('That screen belongs to someone else', { description: 'Sign out to switch to a different person.' })
  }, [wrongPerson])

  if (ok) return <>{children}</>
  if (session) return <Navigate to={homeOf(session)} replace />
  return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />
}
