import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [join(dir, f)] : []))

describe('effects', () => {
  it('never hand React a value that is not a clean-up function', () => {
    // `useEffect(() => something(), [...])` returns whatever something() returns. A browser that returns a promise
    // (scrollIntoView, scrollTo…) then crashes the screen with "destroy is not a function". Use a block body.
    const bad: string[] = []
    for (const file of walk(join(__dirname))) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/use(?:Layout|Insertion)?Effect\(\s*\(\)\s*=>\s*([^{\s(][^\n]*)/g)) if (!/^(?:\(\)\s*=>|function)/.test(m[1])) bad.push(`${file.replace(__dirname, 'src')}: ${m[0].slice(0, 80)}`)
    }
    expect(bad).toEqual([])
  })
})
