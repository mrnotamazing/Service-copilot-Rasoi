import { describe, expect, it } from 'vitest'
import { DEMO_CONFIG } from './config.ts'
import { dishesNamed } from './dishNames.ts'

const named = (text: string) => dishesNamed(text, DEMO_CONFIG.menu).map((m) => m.name)

describe('dishesNamed', () => {
  it('finds a dish by its English name or a word only it has', () => {
    expect(named('Is the galouti kebab vegetarian?')).toEqual(['Galouti kebab'])
    expect(named('what wine goes with the lamb?')).toEqual(['Slow-cooked lamb shank'])
    expect(named('Paneer tikka and kulfi for table 4')).toEqual(['Paneer tikka', 'Pistachio kulfi'])
  })

  it('finds a dish written in Hindi, Nepali, Bengali, Tamil or Spanish', () => {
    expect(named('क्या गलौटी कबाब शाकाहारी है?')).toEqual(['Galouti kebab'])
    expect(named('पनिर टिक्कामा के छ?')).toEqual(['Paneer tikka'])
    expect(named('দম বিরিয়ানিতে কী আছে?')).toEqual(['Dum biryani'])
    expect(named('பனீர் டிக்கா சைவமா?')).toEqual(['Paneer tikka'])
    expect(named('¿El risotto de trufa lleva alcohol?')).toEqual(['Truffle risotto'])
  })

  it('ignores words that are in dish names but don’t pick one out', () => {
    expect(named('How long has the food been cooked?')).toEqual([])
    expect(named('A guest wants soup with no cream')).toEqual([])
  })
})
