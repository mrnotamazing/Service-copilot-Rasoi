import { motion, useReducedMotion } from 'motion/react'
import { useState, type RefObject } from 'react'
import { Mascot } from '../brand/marks.tsx'
import { usePrefs } from '../lib/prefs.ts'

/**
 * The chef dashes along the rule when it comes into view, and runs to the other end (turning to
 * face the way it's going) whenever the pointer moves over the section. Still for reduced motion.
 */
export function RunningChef({ trigger }: { trigger: RefObject<(() => void) | null> }) {
  const device = useReducedMotion()
  const still = usePrefs().reduceMotion || device
  const [end, setEnd] = useState<0 | 1>(0)
  const [running, setRunning] = useState(false)
  const [facing, setFacing] = useState<1 | -1>(1)
  trigger.current = () => {
    if (still || running) return
    setFacing(end === 0 ? 1 : -1)
    setRunning(true)
    setEnd(end === 0 ? 1 : 0)
  }
  return (
    // The track is the rule minus the chef's own width, so x: 100% lands exactly at the far end.
    <motion.div
      className="pointer-events-none absolute -top-[36px] left-0 w-[calc(100%-60px)]"
      initial={false}
      animate={{ x: `${end * 100}%` }}
      transition={{ duration: 2.2, ease: [0.45, 0, 0.25, 1] }}
      onViewportEnter={() => end === 0 && !running && trigger.current?.()}
      viewport={{ once: true, amount: 1 }}
      onAnimationComplete={() => {
        setRunning(false)
        // Back home on the left, it turns to face the page again.
        if (end === 0) setFacing(1)
      }}
    >
      <div className="w-[60px] transition-transform duration-200" style={{ transform: `scaleX(${facing})` }}>
        <Mascot running={running} className="w-[60px]" speed="var(--muted-foreground)" />
      </div>
    </motion.div>
  )
}
