import { Loader2, Lock, Sprout } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useT } from '../i18n/index.ts'
import { useAi } from '../lib/ai.ts'
import { AiAnswerBox } from './AiAnswer.tsx'

/** A private tip built only from this server's own shift. Nobody else can see it. */
export function CoachCard({ staffId }: { staffId: string }) {
  const t = useT()
  const coach = useAi()
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Sprout className="size-5 text-primary" /> {t('coach.title')}
      </h2>
      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
        <Lock className="size-3 shrink-0" /> {t('coach.sub')}
      </p>
      <Button variant="secondary" className="mt-3 h-11 w-full rounded-xl" disabled={coach.loading} onClick={() => coach.ask('coach', { staffId })}>
        {coach.loading ? <Loader2 className="animate-spin" /> : <Sprout />} {coach.answer ? t('coach.again') : t('coach.get')}
      </Button>
      <AiAnswerBox answer={coach.answer} error={coach.error} className="mt-3" />
    </section>
  )
}
