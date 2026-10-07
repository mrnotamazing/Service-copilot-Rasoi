import { Cat, ChefHat, Cherry, Coffee, Croissant, Dog, Fish, Flame, Flower2, Heart, Leaf, Moon, Music, Star, Sun, Wine } from 'lucide-react'
import type { Staff } from '../../shared/types.ts'
import { cn } from '@/lib/utils'

/** The illustrated avatars, drawn as vector icons so they stay crisp at any size. */
export const AVATAR_ICON: Record<string, typeof Star> = {
  chef: ChefHat,
  star: Star,
  leaf: Leaf,
  flame: Flame,
  coffee: Coffee,
  wine: Wine,
  cherry: Cherry,
  croissant: Croissant,
  fish: Fish,
  heart: Heart,
  moon: Moon,
  sun: Sun,
  music: Music,
  flower: Flower2,
  cat: Cat,
  dog: Dog,
}

/** A person as they chose to appear: their photo, an illustration, or their initial on their colour. */
export function Avatar({ staff, className, style }: { staff: Pick<Staff, 'name' | 'color' | 'avatar'>; className?: string; style?: React.CSSProperties }) {
  const base = cn('grid shrink-0 place-items-center overflow-hidden rounded-full font-display text-white select-none', className)
  if (staff.avatar?.startsWith('data:image/'))
    return <img src={staff.avatar} alt="" className={cn(base, 'object-cover')} style={{ background: staff.color, ...style }} draggable={false} />
  const Icon = staff.avatar?.startsWith('icon:') ? AVATAR_ICON[staff.avatar.slice(5)] : undefined
  return (
    <span className={base} style={{ background: staff.color, ...style }} aria-hidden>
      {Icon ? <Icon className="size-[55%]" strokeWidth={1.8} /> : staff.name[0]}
    </span>
  )
}
