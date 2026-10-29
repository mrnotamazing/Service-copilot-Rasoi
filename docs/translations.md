# Translations

TableMate speaks English, Hindi, Nepali, Bengali, Tamil and Spanish. Every screen follows the language chosen in Settings; nothing needs a reload.

## Writing text in the code

- **Inside a component:** `const t = useT()` then `t('some.key')` (keys live in `src/i18n/en.ts` and every other dictionary; TypeScript refuses a key that one language is missing).
- **Text kept in a list or a message (outside a component):** wrap the English in `L('Text in English')` or `L('{n} min over', { n })`. It is looked up by its English wording in the dictionaries and shown in the current language. Keep lists that use `L()` inside a function (or a `() =>` constant) so they are read when drawn, not once at load.
- Dictionary keys for such text are `ui.<screen>.<words>` (written in JSX) and `ui.lit.<words>` / `ui.fmt.<words>` (written with `L()`).

## Adding or changing a string

1. Write it in English in the code as above and add it to `src/i18n/en.ts`.
2. Add the same key to `hi.ts`, `es.ts`, `ne.ts`, `bn.ts`, `ta.ts`. `npm test` fails if a language is missing it, drops a `{placeholder}`, or still has an English sentence.
3. Names, dish names, web addresses and bibliographic references stay as written.

## Not translated on purpose

- The promo film's picture text and narration (English voice-over).
- Menu item names and descriptions and staff names (restaurant data, entered by the restaurant).
- Text the AI writes: it answers in the language of the question.

## Read aloud

Cards and assistant answers are read in the chosen language: with the natural ElevenLabs voice for English, Spanish, Hindi and Tamil when `ELEVENLABS_API_KEY` is set, otherwise with the device's own voice. Nepali and Bengali always use the device voice. A language with no voice on the device is read in English instead of being skipped.
