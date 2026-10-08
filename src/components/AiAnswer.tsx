import { Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import type { LiveAnswer } from '../lib/ai.ts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useT } from '../i18n/index.ts'

export function AiAnswerBox({ answer, error, quote, className }: { answer: LiveAnswer | null; error?: string | null; quote?: boolean; className?: string }) {
  const t = useT()
  if (error) return <p className={cn('text-sm text-destructive', className)}>{error}</p>
  if (!answer) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-lg border border-primary/30 bg-accent/60 p-3', className)}
    >
      <p lang={answer.source === 'built-in' && !answer.streaming ? 'en' : undefined} className={cn('whitespace-pre-line text-sm leading-relaxed', quote && 'text-[15px] italic')}>{quote ? `“${answer.text}”` : answer.text}</p>
      {answer.streaming ? (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="size-3 animate-pulse text-primary" /> {t('chat.thinking')}
        </p>
      ) : (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1 text-[10px] font-normal text-muted-foreground">
          <Sparkles className="size-3" /> {answer.source === 'claude' ? t('chat.byClaude') : answer.source === 'ollama' ? t('chat.byOllama') : answer.source === 'dify' ? t('assist.dify') : t('assist.builtIn')}
        </Badge>
        {answer.notice && <span className="text-[11px] text-warn">{answer.notice}</span>}
        {answer.source === 'built-in' && t.lang !== 'en' && <span className="text-[11px] text-muted-foreground">{t('assist.englishNote')}</span>}
      </div>
      )}
    </motion.div>
  )
}
