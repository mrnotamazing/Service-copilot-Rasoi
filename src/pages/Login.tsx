// Who's signing in? A server, the kitchen pass or the manager, each with the same demo password
// for now. A person only ever sees their own screen, and signing in greets them.

import { ArrowRight, ChefHat, Eye, EyeOff, LayoutDashboard, Lock, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Mascot, TAGLINE, Wordmark } from '../brand/marks.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { goodbyeNote, homeOf, signIn, useSession, welcome } from '../lib/auth.ts'
import { haptic } from '../lib/haptics.ts'
import { useSnapshot } from '../lib/live.ts'
import type { Role } from '../lib/role.ts'

type Kind = Role['kind']
const KINDS: { kind: Kind; label: string; Icon: typeof ChefHat; hint: string }[] = [
  { kind: 'server', label: 'Server', Icon: UserRound, hint: 'Your tables and next three moves' },
  { kind: 'kitchen', label: 'Kitchen', Icon: ChefHat, hint: 'The pass and the tickets' },
  { kind: 'manager', label: 'Manager', Icon: LayoutDashboard, hint: 'The whole floor, without rankings' },
]

export default function Login() {
  const session = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { snap } = useSnapshot('kitchen')
  const [kind, setKind] = useState<Kind>('server')
  const [who, setWho] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A goodbye from finishing a shift is shown once, then forgotten.
  const [bye] = useState(() => goodbyeNote.peek())
  useEffect(() => {
    goodbyeNote.clear()
  }, [])

  if (session) return <Navigate to={homeOf(session)} replace />

  const staff = snap?.config.staff ?? []
  const servers = staff.filter((s) => s.role === 'server')
  const kitchen = staff.find((s) => s.role === 'kitchen')
  const manager = staff.find((s) => s.role === 'manager')
  const person = kind === 'server' ? servers.find((s) => s.id === who) : kind === 'kitchen' ? kitchen : manager

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!person) return setError('Choose who is signing in first.')
    const role: Role = kind === 'server' ? { kind: 'server', staffId: person.id } : { kind }
    const name = person.name
    const err = signIn(role, name, password)
    if (err) {
      setError(err)
      haptic.alert()
      return
    }
    const w = welcome({ role, name })
    haptic.celebrate()
    toast.success(w.title, { description: w.line, duration: 7000 })
    // Back to where they were headed, if it is theirs; otherwise their own home.
    const next = params.get('next')
    const own = homeOf({ role, name })
    navigate(next && next.startsWith(own) ? next : own, { replace: true })
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto grid min-h-dvh w-full max-w-5xl items-center gap-8 px-4 py-8 md:grid-cols-[1fr_minmax(0,26rem)] md:px-8">
        <div className="hidden md:block">
          <Mascot running className="w-52" speed="var(--muted-foreground)" />
          <Wordmark className="mt-4 text-4xl" />
          <p className="mt-2 max-w-sm text-lg text-muted-foreground text-pretty">{TAGLINE}</p>
          <p className="mt-8 max-w-sm text-sm text-muted-foreground text-pretty">Each person signs in to their own screen. Servers see their tables, the kitchen sees the pass, and managers see the floor, never a ranking of people.</p>
        </div>

        <form onSubmit={submit} className="rounded-3xl border bg-card p-6 shadow-sm md:p-7" aria-labelledby="signin-title">
          <div className="mb-5 flex items-center gap-3 md:hidden">
            <Mascot className="h-10 w-auto" speed="var(--muted-foreground)" />
            <Wordmark className="text-2xl" />
          </div>
          {bye && (
            <div className="mb-5 rounded-2xl bg-accent/70 px-4 py-3 text-sm" role="status">
              <div className="font-display text-base">{bye.title}</div>
              <p className="text-muted-foreground text-pretty">{bye.line}</p>
            </div>
          )}
          <h1 id="signin-title" className="font-display text-2xl">
            Sign in
          </h1>
          <p className="text-sm text-muted-foreground">Pick who you are, then enter the password.</p>

          <div role="radiogroup" aria-label="I am the" className="mt-4 grid grid-cols-3 gap-2">
            {KINDS.map(({ kind: k, label, Icon }) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => {
                  setKind(k)
                  setError(null)
                }}
                className={cn('flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', kind === k ? 'border-primary bg-primary/10 font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/60')}
              >
                <Icon className={cn('size-5', kind === k && 'text-primary')} />
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{KINDS.find((x) => x.kind === kind)!.hint}</p>

          {kind === 'server' ? (
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium">Who are you?</legend>
              <div className="grid grid-cols-3 gap-2">
                {servers.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={who === s.id}
                    onClick={() => {
                      setWho(s.id)
                      setError(null)
                    }}
                    className={cn('flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border px-1 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', who === s.id ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-secondary/60')}
                  >
                    <Avatar staff={s} className="size-9 text-base" />
                    <span className="max-w-full truncate">{s.name}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          ) : (
            person && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary/60 px-3 py-2.5">
                <Avatar staff={person} className="size-9 text-base" />
                <span className="text-sm font-medium">{person.name}</span>
              </div>
            )
          )}

          <label htmlFor="pw" className="mt-4 block text-sm font-medium">
            Password
          </label>
          <div className="relative mt-1.5">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="pw" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => (setPassword(e.target.value), setError(null))} className="h-11 pl-9 pr-11" aria-invalid={!!error} aria-describedby={error ? 'pw-err' : undefined} />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {error && (
            <p id="pw-err" role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="mt-5 h-12 w-full rounded-2xl" disabled={!person || !password}>
            Sign in <ArrowRight />
          </Button>
          <p className="mt-4 text-center text-xs text-muted-foreground text-pretty">Demo sign-in: everyone uses the same password for now.</p>
        </form>
      </div>
    </div>
  )
}
