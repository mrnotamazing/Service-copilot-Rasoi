// How to say tonight's dishes and guests' names out loud. Speech engines read menu words
// letter by letter ("gnocchi" as "g-nocky"), so each language gets a spoken form:
// respellings for English voices, the dish in its own script for Indian voices.

import type { Lang } from './prefs.ts'

/** Whole dish names, by language. Keyed by the English menu name. */
const DISHES: Record<string, Partial<Record<Lang, string>>> = {
  'Burrata & heirloom tomato': { en: 'boo-rah-ta with air-loom tomato', hi: 'बुराटा और हेयरलूम टमाटर', ne: 'बुराटा र हेयरलूम टमाटर', bn: 'বুরাটা ও হেয়ারলুম টমেটো', ta: 'புர்ராட்டா மற்றும் ஹெயர்லூம் தக்காளி', es: 'burrata con tomate de herencia' },
  'Galouti kebab': { en: 'ga-low-tee kebaab', hi: 'गलौटी कबाब', ne: 'गलौटी कबाब', bn: 'গলৌটি কাবাব', ta: 'கலௌட்டி கபாப்', es: 'galuti kebab' },
  'Wild mushroom soup': { hi: 'वाइल्ड मशरूम सूप', ne: 'जंगली च्याउको सुप', bn: 'ওয়াইল্ড মাশরুম স্যুপ', ta: 'காட்டுக் காளான் சூப்', es: 'sopa de setas silvestres' },
  'Paneer tikka': { en: 'puh-neer tick-ah', hi: 'पनीर टिक्का', ne: 'पनिर टिक्का', bn: 'পনির টিক্কা', ta: 'பனீர் டிக்கா', es: 'panir tika' },
  'Slow-cooked lamb shank': { hi: 'धीमी आँच पर पका लैम्ब शैंक', ne: 'बिस्तारै पकाइएको लैम्ब शैंक', bn: 'ধীরে রান্না ল্যাম্ব শ্যাঙ্ক', ta: 'மெதுவாகச் சமைத்த லேம்ப் ஷாங்க்', es: 'paletilla de cordero a fuego lento' },
  'Pan-seared sea bass': { en: 'pan seared sea bass', hi: 'पैन-सीयर्ड सी बास', ne: 'प्यान-सियर्ड सी बास', bn: 'প্যান-সিয়ার্ড সি বাস', ta: 'பான்-சியர்டு சீ பாஸ்', es: 'lubina a la plancha' },
  'Truffle risotto': { en: 'truffle ri-zot-oh', hi: 'ट्रफ़ल रिसोटो', ne: 'ट्रफल रिसोटो', bn: 'ট্রাফল রিসোটো', ta: 'ட்ரஃபிள் ரிசோட்டோ', es: 'risotto de trufa' },
  'Dum biryani': { en: 'dumm bir-yaa-nee', hi: 'दम बिरयानी', ne: 'दम बिरयानी', bn: 'দম বিরিয়ানি', ta: 'தம் பிரியாணி', es: 'dum biriani' },
  'Pumpkin gnocchi': { en: 'pumpkin nyok-ee', hi: 'कद्दू न्योकी', ne: 'फर्सीको न्योकी', bn: 'কুমড়োর নিয়োকি', ta: 'பூசணி ஞோக்கி', es: 'ñoquis de calabaza' },
  'Chocolate fondant': { en: 'chocolate fon-dahn', hi: 'चॉकलेट फ़ोंडां', ne: 'चकलेट फन्डाँ', bn: 'চকোলেট ফঁদাঁ', ta: 'சாக்லேட் ஃபொண்டான்ட்', es: 'coulant de chocolate' },
  'Pistachio kulfi': { en: 'pistachio kool-fee', hi: 'पिस्ता कुल्फ़ी', ne: 'पिस्ता कुल्फी', bn: 'পেস্তা কুলফি', ta: 'பிஸ்தா குல்ஃபி', es: 'kulfi de pistacho' },
  'Saffron crème brûlée': { en: 'saffron krem broo-lay', hi: 'केसर क्रेम ब्रूले', ne: 'केसर क्रेम ब्रुले', bn: 'জাফরান ক্রেম ব্রুলে', ta: 'குங்குமப்பூ க்ரெம் ப்ரூலே', es: 'crème brûlée de azafrán' },
}

/** Single words English voices often get wrong (dishes not on the menu above, guest names). */
const WORDS_EN: Record<string, string> = {
  biryani: 'bir-yaa-nee',
  paneer: 'puh-neer',
  tikka: 'tick-ah',
  kulfi: 'kool-fee',
  gnocchi: 'nyok-ee',
  burrata: 'boo-rah-ta',
  risotto: 'ri-zot-oh',
  bruschetta: 'broo-sket-ta',
  dal: 'daal',
  naan: 'naahn',
  masala: 'muh-saa-la',
  korma: 'kor-ma',
  samosa: 'suh-mo-sa',
  chaat: 'chaaht',
  dosa: 'doh-sa',
  'crème': 'krem',
  'brûlée': 'broo-lay',
  heirloom: 'air-loom',
  'd’souza': 'de-soo-za',
  "d'souza": 'de-soo-za',
  iyer: 'eye-yer',
  'mx.': 'mix',
  'ms.': 'miz',
  'dr.': 'doctor',
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const DISH_RE = new RegExp(Object.keys(DISHES).sort((a, b) => b.length - a.length).map(escape).join('|'), 'gi')
const WORD_RE = new RegExp(`(?<![\\p{L}])(${Object.keys(WORDS_EN).map(escape).join('|')})(?![\\p{L}])`, 'giu')

/** Replace dish names and tricky words with forms this language's voice says correctly. */
export function pronounce(text: string, lang: Lang): string {
  let out = text.replace(DISH_RE, (m) => {
    const entry = Object.entries(DISHES).find(([k]) => k.toLowerCase() === m.toLowerCase())?.[1]
    return entry?.[lang] ?? (lang === 'en' ? m : (entry?.en ?? m))
  })
  // Respellings are for English voices only; Spanish spelling already sounds these out correctly.
  if (lang === 'en') out = out.replace(WORD_RE, (m) => WORDS_EN[m.toLowerCase()] ?? m)
  return out
}
