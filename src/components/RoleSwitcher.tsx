import { ChefHat, LayoutDashboard } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Staff } from '../../shared/types.ts'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useT } from '../i18n/index.ts'
import { useStaffList } from '../lib/live.ts'
import { homeFor, setRole, useRole, type Role } from '../lib/role.ts'
import { Avatar } from './Avatar.tsx'

const encode = (r: Role) => (r.kind === 'server' ? `server:${r.staffId}` : r.kind)
const decode = (v: string): Role => (v.startsWith('server:') ? { kind: 'server', staffId: v.slice(7) } : { kind: v as 'kitchen' | 'manager' })

/**
 * "Signed in as": switches this device between a server's app, the kitchen display and the
 * manager console. Each role has its own home, navigation and colours.
 */
export function RoleSwitcher({ compact, className }: { compact?: boolean; className?: string }) {
  const t = useT()
  const role = useRole()
  const staff = useStaffList()
  const navigate = useNavigate()
  const servers = staff.filter((s) => s.role === 'server')
  const me = role?.kind === 'server' ? staff.find((s) => s.id === role.staffId) : undefined

  const label = role?.kind === 'server' ? (me?.name ?? '') : role?.kind === 'kitchen' ? t('role.kitchen') : role?.kind === 'manager' ? t('role.manager') : t('role.choose')
  const sub = role?.kind === 'server' ? t('role.serverApp') : role?.kind === 'kitchen' ? t('role.kitchenApp') : role?.kind === 'manager' ? t('role.managerApp') : 'Saffron House'

  return (
    <Select
      value={role ? encode(role) : undefined}
      onValueChange={(v) => {
        const r = decode(v)
        setRole(r)
        navigate(homeFor(r))
      }}
    >
      <SelectTrigger
        aria-label={t('role.signedInAs', { who: label })}
        className={cn(
          'border-transparent bg-transparent shadow-none hover:bg-sidebar-accent/60 data-[size=default]:h-auto',
          compact ? 'size-12 justify-center rounded-2xl p-0 [&>svg:last-child]:hidden' : 'w-full min-w-0 justify-start gap-2.5 rounded-xl px-2 py-1.5',
          className,
        )}
      >
        <RoleBadge role={role} me={me} className={compact ? 'size-9' : 'size-8'} />
        {!compact && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-sm font-medium leading-tight text-foreground">{label}</span>
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">{sub}</span>
            </span>
          </>
        )}
      </SelectTrigger>
      <SelectContent position="popper" side={compact ? 'right' : 'top'} align="start" className="min-w-60">
        <SelectGroup>
          <SelectLabel>{t('role.serving')}</SelectLabel>
          {servers.map((s) => (
            <SelectItem key={s.id} value={`server:${s.id}`}>
              <Avatar staff={s} className="size-6 text-xs" /> {s.name}
            </SelectItem>
          ))}
        </SelectGroup>
        <SelectSeparator />
        <SelectItem value="kitchen">
          <span className="grid size-6 place-items-center rounded-full bg-secondary text-primary">
            <ChefHat className="size-3.5" />
          </span>
          {t('role.kitchen')}
        </SelectItem>
        <SelectItem value="manager">
          <span className="grid size-6 place-items-center rounded-full bg-secondary text-primary">
            <LayoutDashboard className="size-3.5" />
          </span>
          {t('role.manager')}
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

function RoleBadge({ role, me, className }: { role: Role | null; me?: Staff; className?: string }) {
  if (me) return <Avatar staff={me} className={cn('text-sm', className)} />
  const Icon = role?.kind === 'kitchen' ? ChefHat : LayoutDashboard
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground', className)}>
      <Icon className="size-4" />
    </span>
  )
}
