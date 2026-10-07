import { Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import type { AiAnswer } from '../lib/ai.ts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function AiAnswerBox({ answer, error, quote, className }: { answer: AiAnswer | null; error?: string | null; quote?: boolean; className?: string }) {
  if (error) return <p className={cn('text-sm text-destructive', className)}>{error}</p>
  if (!answer) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-lg border border-primary/30 bg-accent/60 p-3', className)}
    >
      <p className={cn('whitespace-pre-line text-sm leading-relaxed', quote && 'text-[15px] italic')}>{quote ? `“${answer.text}”` : answer.text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="gap-1 text-[10px] font-normal text-muted-foreground">
          <Sparkles className="size-3" /> {answer.source === 'dify' ? 'AI via Dify' : 'Built-in writer'}
        </Badge>
        {answer.notice && <span className="text-[11px] text-warn">{answer.notice}</span>}
      </div>
    </motion.div>
  )
}
