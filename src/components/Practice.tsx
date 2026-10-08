import { Drama } from 'lucide-react'
import { useState } from 'react'
import type { AiAnswer } from '../../server/ai.ts'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { useT } from '../i18n/index.ts'
import { Assistant, type AssistantRole } from './Assistant.tsx'

/** Entry card on the Profile tab: opens the assistant straight into the practice room. */
export function PracticeCard({ staffId, provider }: { staffId: string; provider: AiAnswer['source'] }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Drama className="size-5 text-primary" /> {t('practice.title')}
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{t('practice.sub')}</p>
      <Button variant="secondary" className="mt-3 h-11 w-full rounded-xl" onClick={() => setOpen(true)}>
        <Drama /> {t('practice.start')}
      </Button>
      <AssistantDrawer open={open} onOpenChange={setOpen} staffId={staffId} provider={provider} initialMode="practice" />
    </section>
  )
}

/** The assistant in a bottom sheet: used by the sparkle button and by the practice card. */
export function AssistantDrawer({
  open,
  onOpenChange,
  staffId,
  provider,
  initialMode = 'ask',
  wide,
  role = 'server',
  initialScenario,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  staffId: string
  provider: AiAnswer['source']
  initialMode?: 'ask' | 'practice'
  wide?: boolean
  role?: AssistantRole
  /** Open the practice room straight into this situation (e.g. one suggested from tonight's shift). */
  initialScenario?: string
}) {
  const t = useT()
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={wide ? 'mx-auto h-[88dvh] max-w-xl' : 'mx-auto h-[88dvh] max-w-[440px]'}>
        <DrawerHeader className="pb-2">
          <DrawerTitle className="font-display text-2xl">{t('hdr.ask')}</DrawerTitle>
          <DrawerDescription>{t(role === 'manager' ? 'chat.subMgr' : 'chat.sub')}</DrawerDescription>
        </DrawerHeader>
        {open && (
          <div className="min-h-0 flex-1">
            <Assistant staffId={staffId} provider={provider} initialMode={initialMode} role={role} initialScenario={initialScenario} />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
