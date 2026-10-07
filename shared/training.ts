// What a senior trainer would tell a new server. Powers the built-in assistant (no AI service
// needed) and is given to the language model as background, so both give the same advice.

export interface Lesson {
  id: string
  /** Words that suggest the question is about this. */
  keys: string[]
  title: string
  answer: string
  /** Good next questions to offer as chips. */
  next: string[]
}

export const LESSONS: Lesson[] = [
  {
    id: 'greet',
    keys: ['greet', 'welcome', 'seated', 'first', 'approach', 'hello', 'arrive', 'arrival'],
    title: 'The first two minutes',
    answer:
      'Reach the table within 2 minutes of seating, even if you only have a second: "Good evening, welcome. I’ll be right with you." Then water, menus and today’s specials. Use the guest’s name if the booking has one, and mention an occasion if you know it. Eye contact first, notepad second.',
    next: ['How do I recommend dishes?', 'What if I’m stuck at another table?'],
  },
  {
    id: 'busy',
    keys: ['stuck', 'busy', 'rush', 'overwhelmed', 'stress', 'too many', 'behind', 'calm'],
    title: 'When you’re slammed',
    answer:
      'Do the next three things, not all twenty: that’s what the cards are for. Acknowledge waiting tables with eye contact or a quick "I’ll be with you in two minutes". Combine trips (the card shows what’s on the way). Ask a teammate for help early, not when it’s already gone wrong, and thank them with kudos afterwards.',
    next: ['How do I ask a teammate for help?', 'How do I warn guests about a delay?'],
  },
  {
    id: 'delay',
    keys: ['delay', 'late', 'wait', 'waiting', 'slow', 'kitchen behind', 'taking long', 'how long'],
    title: 'Kitchen delays',
    answer:
      'Tell the table before they ask. Be honest and specific: "Your mains will be about 6 more minutes." Never blame the kitchen. Offer something small while they wait: bread, a top-up, or an amuse-bouche if the manager allows. The delay card gives you the kitchen’s real estimate.',
    next: ['What do I say exactly?', 'When should I involve the manager?'],
  },
  {
    id: 'complaint',
    keys: ['complaint', 'complain', 'unhappy', 'angry', 'upset', 'cold', 'wrong', 'bad', 'recover', 'sorry', 'apolog'],
    title: 'Handling a complaint (LAST)',
    answer:
      'Use LAST: Listen without interrupting. Apologise sincerely, even if it isn’t your fault. Solve it fast: replace the dish, take it off the bill if your manager agrees, or bring the manager. Thank them for telling you. Then check back a few minutes later. Tap "Not happy" at the check-in so the recovery card and the manager can help.',
    next: ['Practise a cold-food complaint', 'When should I involve the manager?'],
  },
  {
    id: 'manager',
    keys: ['manager', 'escalate', 'involve', 'comp', 'free', 'on the house', 'refund'],
    title: 'When to bring the manager',
    answer:
      'Bring the manager when a guest is still unhappy after your fix, asks for them, raises a safety or allergy issue, or when a refund or free item is needed. Tap "Ask the manager" on the recovery card: they get a visit request with the table. You haven’t failed by asking; it shows the guest they matter.',
    next: ['How do I handle a complaint?', 'What if a guest is rude?'],
  },
  {
    id: 'allergy',
    keys: ['allergy', 'allergic', 'nut', 'nuts', 'gluten', 'dairy', 'shellfish', 'egg', 'safe', 'contain'],
    title: 'Allergies',
    answer:
      'Treat every allergy as serious. Never guess or promise a dish is safe from memory: check the dish’s ingredients in the app and confirm with the kitchen. Tap "Send to kitchen" so the allergy is on the ticket. If a dish clashes, the safety card appears at the top: tell the kitchen or confirm with the guest. When unsure, say: "Let me check with the chef to be completely sure."',
    next: ['What’s in the galouti kebab?', 'Explain Jain food'],
  },
  {
    id: 'jain',
    keys: ['jain', 'root', 'onion', 'garlic', 'potato'],
    title: 'Jain guests',
    answer:
      'Jain diners avoid meat, fish, eggs and root vegetables: onion, garlic, potato, carrot, beetroot. Some also avoid eating after sunset or honey. Ask politely how strict they are, then check each dish with the kitchen; many sauces start with onion and garlic.',
    next: ['Which dishes contain onion or garlic?', 'Explain vegan and halal'],
  },
  {
    id: 'vegan',
    keys: ['vegan', 'plant', 'vegetarian', 'veg', 'halal', 'pork', 'alcohol', 'meat'],
    title: 'Vegan, vegetarian and halal',
    answer:
      'Vegan: no meat, fish, dairy (ghee, paneer, cream, butter), eggs or honey. Vegetarian (Indian sense) usually allows dairy but not eggs; ask. Halal: no pork or alcohol, and meat must be halal; wine in a sauce counts. Use the app’s safety check and confirm with the kitchen.',
    next: ['Which dishes are vegan?', 'How do I handle allergies?'],
  },
  {
    id: 'upsell',
    keys: ['upsell', 'recommend', 'suggest', 'sell', 'special', 'pairing', 'wine', 'drink', 'dessert'],
    title: 'Recommending without pushing',
    answer:
      'Ask one question first ("Something light or rich tonight?"), then suggest two options, not five, with one honest reason each: "The galouti kebab melts in the mouth; the paneer tikka has a smoky char." Offer desserts when mains are cleared, with one you love. Never push a guest who has said no.',
    next: ['How do I describe a dish well?', 'When do I offer desserts?'],
  },
  {
    id: 'access',
    keys: ['wheelchair', 'disab', 'access', 'blind', 'vision', 'deaf', 'hearing', 'mobility', 'elderly'],
    title: 'Guests with access needs',
    answer:
      'Talk to the guest, not their companion. Wheelchair users: a clear step-free route and a chair removed at the table; don’t move the chair without asking. Low vision: read out specials, offer the large-print menu, tell them where things are on the table. Hard of hearing: face them, speak clearly (not loudly), and offer to write. Ask "How can I make this easier?" rather than assuming.',
    next: ['How do I talk to a guest who speaks another language?', 'Kids at the table'],
  },
  {
    id: 'language',
    keys: ['language', 'english', 'hindi', 'speak', 'foreign', 'tourist', 'translate', 'understand'],
    title: 'Language barriers',
    answer:
      'Slow down, use short sentences and gestures, and point at the menu. Check the staff list: teammates show the languages they speak, so you can bring someone over. Avoid slang. Confirm the order back clearly. Never laugh at a misunderstanding; smile and try another way.',
    next: ['Guests with access needs', 'How do I handle a complaint?'],
  },
  {
    id: 'kids',
    keys: ['kid', 'child', 'children', 'baby', 'high chair', 'highchair', 'family'],
    title: 'Families and children',
    answer:
      'Offer a high chair before they ask, bring water and something to nibble early, and fire children’s food first. Keep hot plates and knives away from small hands. Speak to the child kindly; parents notice.',
    next: ['How do I recommend dishes?', 'Guests with access needs'],
  },
  {
    id: 'rude',
    keys: ['rude', 'shout', 'yell', 'disrespect', 'abuse', 'harass', 'drunk', 'aggressive'],
    title: 'Rude or difficult guests',
    answer:
      'Stay calm and polite; don’t match their tone. Acknowledge the problem underneath ("You’ve waited too long, I’m sorry"), then act. If a guest is abusive, harasses you or is drunk and aggressive, step away and get the manager: you never have to handle that alone.',
    next: ['Practise a rude guest', 'When should I involve the manager?'],
  },
  {
    id: 'bill',
    keys: ['bill', 'check', 'pay', 'payment', 'split', 'wrong bill', 'charge'],
    title: 'The bill',
    answer:
      'Present within 3 minutes of being asked. When desserts are cleared, have it printed and ready. Check the bill before you bring it. If something’s wrong, apologise, fix it on the spot and thank them for catching it. Offer splitting without fuss.',
    next: ['Practise a wrong-bill moment', 'How do I say goodbye?'],
  },
  {
    id: 'farewell',
    keys: ['goodbye', 'farewell', 'leave', 'leaving', 'door', 'see off'],
    title: 'A warm goodbye',
    answer:
      'Thank them by name, mention the occasion if there was one, and invite them back. Help with coats or the door if you can. The goodbye is what they remember on the way home.',
    next: ['What goes in a table reset?', 'How do I greet a table?'],
  },
  {
    id: 'reset',
    keys: ['reset', 'clean', 'turn', 'set up', 'linen', 'cutlery', 'condiment'],
    title: 'Table reset',
    answer:
      'Within 5 minutes of payment: clear and wipe, fresh linen and napkins, cutlery and glassware polished, condiments and salt and pepper topped up, menus and candle in place. Use the checklist on the card; it’s faster than memory in a rush.',
    next: ['How do I handle a rush?', 'How fast should I greet?'],
  },
  {
    id: 'checkback',
    keys: ['check back', 'check-in', 'checkin', 'how is everything', 'clear', 'clearing', 'plates'],
    title: 'Check-backs and clearing',
    answer:
      'Check back about 3 minutes after food lands: one quick, specific question ("How’s the lamb?"). Tap the face that matches the table so problems get fixed early. Clear only when everyone at the table has finished, from the right where possible.',
    next: ['What if they’re not happy?', 'When do I offer desserts?'],
  },
  {
    id: 'describe',
    keys: ['describe', 'explain dish', 'tell about', 'menu knowledge', 'pronounce', 'say'],
    title: 'Describing a dish',
    answer:
      'Three parts: what it is, how it’s made, why they’ll like it. "Galouti kebab: minced lamb with spices, seared on the griddle, so soft it melts." Tap the speaker on any card to hear dish names said properly.',
    next: ['What’s in the galouti kebab?', 'How do I recommend dishes?'],
  },
]

/** Pick the lessons that best match a question. */
export function findLessons(question: string, limit = 2): Lesson[] {
  const q = ` ${question.toLowerCase()} `
  return LESSONS.map((l) => ({ l, score: l.keys.reduce((n, k) => n + (q.includes(k) ? (k.includes(' ') ? 2 : 1) : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.l)
}

export const STARTERS = ['Brief me on my section', 'How do I handle a complaint?', 'What’s in the galouti kebab?', 'Explain Jain food', 'How do I recommend dishes?']
