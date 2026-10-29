// Dish names as staff write and say them in each app language. Used by read-aloud (spoken by that
// language's voice) and by the assistant to recognise a dish named in any script.

import type { MenuItem } from './types.ts'

export const DISH_NAMES: Record<string, Partial<Record<'hi' | 'ne' | 'bn' | 'ta' | 'es', string>>> = {
  'Burrata & heirloom tomato': { hi: 'बुराटा और हेयरलूम टमाटर', ne: 'बुराटा र हेयरलूम टमाटर', bn: 'বুরাটা ও হেয়ারলুম টমেটো', ta: 'புர்ராட்டா மற்றும் ஹெயர்லூம் தக்காளி', es: 'burrata con tomate de herencia' },
  'Galouti kebab': { hi: 'गलौटी कबाब', ne: 'गलौटी कबाब', bn: 'গলৌটি কাবাব', ta: 'கலௌட்டி கபாப்', es: 'galuti kebab' },
  'Wild mushroom soup': { hi: 'वाइल्ड मशरूम सूप', ne: 'जंगली च्याउको सुप', bn: 'ওয়াইল্ড মাশরুম স্যুপ', ta: 'காட்டுக் காளான் சூப்', es: 'sopa de setas silvestres' },
  'Paneer tikka': { hi: 'पनीर टिक्का', ne: 'पनिर टिक्का', bn: 'পনির টিক্কা', ta: 'பனீர் டிக்கா', es: 'panir tika' },
  'Slow-cooked lamb shank': { hi: 'धीमी आँच पर पका लैम्ब शैंक', ne: 'बिस्तारै पकाइएको लैम्ब शैंक', bn: 'ধীরে রান্না ল্যাম্ব শ্যাঙ্ক', ta: 'மெதுவாகச் சமைத்த லேம்ப் ஷாங்க்', es: 'paletilla de cordero a fuego lento' },
  'Pan-seared sea bass': { hi: 'पैन-सीयर्ड सी बास', ne: 'प्यान-सियर्ड सी बास', bn: 'প্যান-সিয়ার্ড সি বাস', ta: 'பான்-சியர்டு சீ பாஸ்', es: 'lubina a la plancha' },
  'Truffle risotto': { hi: 'ट्रफ़ल रिसोटो', ne: 'ट्रफल रिसोटो', bn: 'ট্রাফল রিসোটো', ta: 'ட்ரஃபிள் ரிசோட்டோ', es: 'risotto de trufa' },
  'Dum biryani': { hi: 'दम बिरयानी', ne: 'दम बिरयानी', bn: 'দম বিরিয়ানি', ta: 'தம் பிரியாணி', es: 'dum biriani' },
  'Pumpkin gnocchi': { hi: 'कद्दू न्योकी', ne: 'फर्सीको न्योकी', bn: 'কুমড়োর নিয়োকি', ta: 'பூசணி ஞோக்கி', es: 'ñoquis de calabaza' },
  'Chocolate fondant': { hi: 'चॉकलेट फ़ोंडां', ne: 'चकलेट फन्डाँ', bn: 'চকোলেট ফঁদাঁ', ta: 'சாக்லேட் ஃபொண்டான்ட்', es: 'coulant de chocolate' },
  'Pistachio kulfi': { hi: 'पिस्ता कुल्फ़ी', ne: 'पिस्ता कुल्फी', bn: 'পেস্তা কুলফি', ta: 'பிஸ்தா குல்ஃபி', es: 'kulfi de pistacho' },
  'Saffron crème brûlée': { hi: 'केसर क्रेम ब्रूले', ne: 'केसर क्रेम ब्रुले', bn: 'জাফরান ক্রেম ব্রুলে', ta: 'குங்குமப்பூ க்ரெம் ப்ரூலே', es: 'crème brûlée de azafrán' },
}

// Words that appear in dish names but say nothing about which dish is meant.
const GENERIC = new Set(['with', 'cooked', 'seared', 'slow', 'wild', 'fresh', 'sauce', 'soup', 'heirloom', 'pan'])

/** Menu items a message names, by the full name or a word only that dish has, in English or any app language. */
export function dishesNamed(text: string, menu: MenuItem[]): MenuItem[] {
  const t = text.toLowerCase()
  const words = (s: string) => s.toLowerCase().split(/[\s,&()\-]+/).filter((w) => [...w].length >= 4 && !GENERIC.has(w))
  const names = menu.map((m) => [m.name, ...Object.values(DISH_NAMES[m.name] ?? {})])
  // How many dishes use each word: only words unique to one dish identify it.
  const uses = new Map<string, number>()
  for (const all of names) for (const w of new Set(all.flatMap(words))) uses.set(w, (uses.get(w) ?? 0) + 1)
  return menu.filter((_, i) => names[i].some((n) => t.includes(n.toLowerCase()) || words(n).some((w) => uses.get(w) === 1 && t.includes(w))))
}
