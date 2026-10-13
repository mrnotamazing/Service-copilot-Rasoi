import { describe, expect, it } from 'vitest'
import { SCENES } from '../../src/pages/intro/scenes.tsx'
import plan from './narration.json'

describe('film narration', () => {
  it('has one line per scene, with the scene lengths the picture uses', () => {
    expect(plan.scenes.map((s) => s.id)).toEqual(SCENES.map((s) => s.id))
    expect(plan.scenes.map((s) => s.ms)).toEqual(SCENES.map((s) => s.ms))
  })
  it('fits each line in its scene at a calm pace (about 2.6 words a second)', () => {
    for (const s of plan.scenes) {
      const words = s.say.split(/\s+/).length
      expect(words / 2.6, s.id).toBeLessThan((s.ms - 600) / 1000)
    }
  })
})
