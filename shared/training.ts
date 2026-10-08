// What a senior trainer would tell a new server, and what an experienced floor manager would tell
// a new manager. Powers the built-in assistant (no AI service needed) and is given to the language
// model as background, so both give the same advice. Inclusion lessons are for everyone.

export type Audience = 'server' | 'manager'

export interface Lesson {
  id: string
  /** Who it's written for. Unset: servers. 'both': servers and managers. */
  for?: Audience | 'both'
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
    keys: ['stuck', 'busy', 'rush', 'slammed', 'overwhelmed', 'stress', 'too many', 'behind', 'calm'],
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
    keys: ['complaint', 'complain', 'unhappy', 'not happy', 'angry', 'upset', 'cold', 'wrong', 'bad', 'recover', 'sorry', 'apolog'],
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
    for: 'both',
    keys: ['allergy', 'allergic', 'nut', 'nuts', 'gluten', 'dairy', 'shellfish', 'egg', 'safe', 'contain'],
    title: 'Allergies',
    answer:
      'Treat every allergy as serious. Never guess or promise a dish is safe from memory: check the dish’s ingredients in the app and confirm with the kitchen. Tap "Send to kitchen" so the allergy is on the ticket. If a dish clashes, the safety card appears at the top: tell the kitchen or confirm with the guest. When unsure, say: "Let me check with the chef to be completely sure."',
    next: ['What’s in the galouti kebab?', 'Explain Jain food'],
  },
  {
    id: 'jain',
    for: 'both',
    keys: ['jain', 'root', 'onion', 'garlic', 'potato'],
    title: 'Jain guests',
    answer:
      'Jain diners avoid meat, fish, eggs and root vegetables: onion, garlic, potato, carrot, beetroot. Some also avoid eating after sunset or honey. Ask politely how strict they are, then check each dish with the kitchen; many sauces start with onion and garlic.',
    next: ['Which dishes contain onion or garlic?', 'Explain vegan and halal'],
  },
  {
    id: 'vegan',
    for: 'both',
    keys: ['vegan', 'plant', 'vegetarian', 'veg', 'halal', 'pork', 'alcohol', 'meat'],
    title: 'Vegan, vegetarian and halal',
    answer:
      'Vegan: no meat, fish, dairy (ghee, paneer, cream, butter), eggs or honey. Vegetarian (Indian sense) usually allows dairy but not eggs; ask. Halal: no pork or alcohol, and meat must be halal; wine in a sauce counts. Use the app’s safety check and confirm with the kitchen.',
    next: ['Which dishes are vegan?', 'How do I handle allergies?'],
  },
  {
    id: 'upsell',
    for: 'both',
    keys: ['upsell', 'recommend', 'suggest', 'sell', 'special', 'pairing', 'wine', 'drink', 'dessert'],
    title: 'Recommending without pushing',
    answer:
      'Ask one question first ("Something light or rich tonight?"), then suggest two options, not five, with one honest reason each: "The galouti kebab melts in the mouth; the paneer tikka has a smoky char." Offer desserts when mains are cleared, with one you love. Never push a guest who has said no.',
    next: ['How do I describe a dish well?', 'When do I offer desserts?'],
  },
  {
    id: 'access',
    for: 'both',
    keys: ['wheelchair', 'disab', 'access', 'blind', 'vision', 'deaf', 'hearing', 'mobility', 'elderly'],
    title: 'Guests with access needs',
    answer:
      'Talk to the guest, not their companion. Wheelchair users: a clear step-free route and a chair removed at the table; don’t move the chair without asking. Low vision: read out specials, offer the large-print menu, tell them where things are on the table. Hard of hearing: face them, speak clearly (not loudly), and offer to write. Ask "How can I make this easier?" rather than assuming.',
    next: ['How do I talk to a guest who speaks another language?', 'Kids at the table'],
  },
  {
    id: 'language',
    for: 'both',
    keys: ['language', 'english', 'hindi', 'speak', 'foreign', 'tourist', 'translate', 'understand'],
    title: 'Language barriers',
    answer:
      'Slow down, use short sentences and gestures, and point at the menu. Check the staff list: teammates show the languages they speak, so you can bring someone over. Avoid slang. Confirm the order back clearly. Never laugh at a misunderstanding; smile and try another way.',
    next: ['Guests with access needs', 'How do I handle a complaint?'],
  },
  {
    id: 'kids',
    for: 'both',
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
    for: 'both',
    keys: ['describe', 'explain dish', 'tell about', 'menu knowledge', 'pronounce', 'say'],
    title: 'Describing a dish',
    answer:
      'Three parts: what it is, how it’s made, why they’ll like it. "Galouti kebab: minced lamb with spices, seared on the griddle, so soft it melts." Tap the speaker on any card to hear dish names said properly.',
    next: ['What’s in the galouti kebab?', 'How do I recommend dishes?'],
  },
  // ——— More for servers ———
  {
    id: 'wine',
    keys: ['wine', 'cocktail', 'mocktail', 'non-alcoholic', 'sommelier', 'beer', 'whisky', 'drinks list'],
    title: 'Drinks and pairings',
    answer:
      'Ask what they usually enjoy, then suggest one glass that suits the dish and one non-alcoholic option, offered just as warmly: plenty of guests don’t drink, for faith, health or choice, and never need to explain. Show the bottle before opening, pour from the right, and never push a second round. If you’re unsure of a pairing, say so and fetch someone who knows.',
    next: ['How do I recommend dishes?', 'What if a guest has had too much to drink?'],
  },
  {
    id: 'indian',
    keys: ['spicy', 'spice', 'chilli', 'chili', 'heat level', 'mild', 'explain indian', 'never had indian', 'first time', 'foreign guest'],
    title: 'Explaining Indian food to new guests',
    answer:
      'Describe, don’t translate: “Galouti kebab is a very soft minced lamb kebab, gently spiced, not hot.” Give heat honestly on a simple scale (mild, medium, hot) and offer to ask the kitchen to tone it down. Suggest sharing plates so they can try more. Never make guests feel they should already know a dish.',
    next: ['How do I describe a dish well?', 'How do I talk to a guest who speaks another language?'],
  },
  {
    id: 'occasion',
    keys: ['birthday', 'anniversary', 'occasion', 'celebrat', 'regular', 'vip', 'proposal', 'cake', 'surprise'],
    title: 'Occasions and regulars',
    answer:
      'If the booking mentions an occasion, acknowledge it early and quietly, and check with the host before any public surprise: not everyone wants a song. For regulars, use their name and remember a preference (“Sparkling water again?”). Treat a first visit with the same care; that’s how regulars are made.',
    next: ['How do I say goodbye?', 'How do I recommend dishes?'],
  },
  {
    id: 'mistake',
    keys: ['mistake', 'wrong order', 'wrong dish', 'spill', 'spilled', 'dropped', 'broke', 'forgot', 'mixed up', 'my fault'],
    title: 'When you make a mistake',
    answer:
      'Own it quickly and simply: “I’m sorry, that’s my mistake. I’ll put it right now.” Fix it first, explain later if at all. For a spill on a guest, bring napkins, offer to pay for cleaning, and tell your manager. Then tell the kitchen or your manager what happened, so it doesn’t happen again. Everyone makes mistakes; how you recover is what guests remember.',
    next: ['How do I handle a complaint?', 'When should I involve the manager?'],
  },
  {
    id: 'teamwork',
    for: 'both',
    keys: ['handover', 'hand over', 'teammate', 'cover my', 'cover for', 'ask for help', 'help from', 'shift change', 'teamwork'],
    title: 'Teamwork and handovers',
    answer:
      'Ask for help early and specifically: “Could you run T4’s mains? I’m stuck at T2.” When you hand over a table, pass on allergies, occasions, what’s ordered and what’s next, in that order. Help back when you’re free, and say thank you; the kudos button in the app is for exactly that.',
    next: ['What do I do when I’m slammed?', 'What goes in a table reset?'],
  },
  {
    id: 'drunk',
    keys: ['drunk', 'intoxicated', 'too much to drink', 'cut off', 'stop serving', 'tipsy'],
    title: 'A guest who has had too much',
    answer:
      'Slow the drinks down politely: offer water and food, and don’t bring another round without checking with your manager. Never argue or embarrass them in front of others. If they become unsafe, aggressive or want to drive, get your manager straight away.',
    next: ['What if a guest is rude?', 'When should I involve the manager?'],
  },
  {
    id: 'selfcare',
    for: 'both',
    keys: ['tired', 'burnout', 'exhausted', 'self care', 'self-care', 'my feet', 'stressed', 'anxious', 'nervous', 'overwhelmed'],
    title: 'Looking after yourself',
    answer:
      'Drink water, eat before service, and take your break; tired servers make more mistakes. In a rush, breathe, look at your top three cards only, and ask for help early. If a guest upset you, tell your manager, take two minutes away from the floor, and use the practice room later to rehearse it. If you’re struggling more often, talk to your manager; that’s part of their job.',
    next: ['What do I do when I’m slammed?', 'How do I ask a teammate for help?'],
  },
  {
    id: 'phone',
    keys: ['phone', 'call', 'reservation', 'booking', 'takeaway', 'take-away', 'enquiry'],
    title: 'Phone calls and bookings',
    answer:
      'Answer within three rings with the restaurant’s name and yours. Repeat back the date, time, number of guests and name, and ask about allergies, access needs and occasions. If you’re on the floor and can’t talk, take a number and promise a call back within ten minutes, then do it.',
    next: ['How fast should I greet?', 'Guests with access needs'],
  },
  // ——— Inclusion: for everyone ———
  {
    id: 'equal',
    for: 'both',
    keys: ['discriminat', 'equal', 'bias', 'prejudice', 'caste', 'religion', 'skin', 'accent', 'appearance', 'judge', 'stereotyp', 'treat everyone', 'fair to'],
    title: 'The same welcome for every guest',
    answer:
      'Every guest gets the same welcome, table, attention and patience, whatever their caste, religion, region, skin colour, accent, age, body, clothes, disability, gender or who they’re with. Don’t guess what someone can afford or will order. Watch for small differences, like checking on some tables less or rushing some guests; they add up. If you see a colleague treat a guest differently, speak to your manager.',
    next: ['How do I avoid assumptions about guests?', 'Religious and cultural food needs'],
  },
  {
    id: 'assume',
    for: 'both',
    keys: ['pronoun', 'gay', 'lesbian', 'lgbt', 'queer', 'trans', 'same-sex', 'partner', 'couple', 'non-binary', 'nonbinary', 'gender', 'assumption', 'assume', 'sir', 'madam', 'who pays'],
    title: 'Service without assumptions',
    answer:
      'Don’t assume relationships, roles or gender. Use the guest’s name, or “you” and “your table”, instead of sir or madam when you’re unsure. Hand the wine list and the bill to whoever asks for them, or place them in the middle. Two guests celebrating are just guests celebrating. If you get someone’s name or pronoun wrong, say “sorry”, use the right one and move on; no long apology.',
    next: ['The same welcome for every guest', 'How do I say a guest’s name?'],
  },
  {
    id: 'faith',
    for: 'both',
    keys: ['beef', 'pork', 'fasting', 'navratri', 'ramadan', 'roza', 'iftar', 'lent', 'kosher', 'sattvic', 'religious', 'vrat', 'ekadashi', 'faith', 'cultural'],
    title: 'Religious and cultural food needs',
    answer:
      'Many guests avoid beef or pork, eat only halal, kosher, Jain or sattvic food, or are fasting (Navratri, Ramadan, Lent, ekadashi). Rules differ from person to person, so ask kindly: “Is there anything you don’t eat, so I can guide you?” Never comment on the choice. For guests breaking a fast at sunset, offer water and something light right away. Check ingredients with the kitchen; wine, gelatine, lard or stock can hide in dishes.',
    next: ['Explain Jain food', 'Explain vegan and halal'],
  },
  {
    id: 'sensory',
    for: 'both',
    keys: ['autis', 'adhd', 'neurodiver', 'sensory', 'noise', 'noisy', 'quiet table', 'dementia', 'learning disab', 'down syndrome'],
    title: 'Neurodivergent and sensory-sensitive guests',
    answer:
      'Some guests find noise, bright light or busy rooms hard. Offer a quieter table, away from the kitchen door and speakers, and keep check-ins calm and few. Speak plainly, give one choice at a time, and be patient with longer answers or repeated questions. Speak to the guest, not only to the person with them. Never comment on behaviour that seems unusual.',
    next: ['Guests with access needs', 'Families and children'],
  },
  {
    id: 'animal',
    for: 'both',
    keys: ['service animal', 'guide dog', 'assistance dog', 'service dog', 'dog'],
    title: 'Guide dogs and assistance animals',
    answer:
      'Welcome assistance animals; they are working, not pets. Seat the guest where the animal can lie out of the walkway, offer a bowl of water, and never pet, feed or distract the animal. Talk to the guest as usual.',
    next: ['Guests with access needs', 'Neurodivergent and sensory-sensitive guests'],
  },
  {
    id: 'elders',
    for: 'both',
    keys: ['elderly', 'older guest', 'senior citizen', 'grandparent', 'walking stick', 'old guest', 'aged'],
    title: 'Older guests',
    answer:
      'Offer a chair with arms near the entrance, a large-print menu and good light. Speak clearly and at a normal pace, not loudly or as if to a child. Offer help with coats and steps, but ask first. Don’t rush the meal or the bill.',
    next: ['Guests with access needs', 'Language barriers'],
  },
  {
    id: 'names',
    for: 'both',
    keys: ['their name', 'guest name', 'guest’s name', "guest's name", 'pronounce a name', 'say a name', 'names'],
    title: 'Getting names right',
    answer:
      'If you’re not sure how to say a name, ask once, quietly: “How do you say your name?” Then use it. Don’t shorten it or give a nickname. The same goes for teammates: learn everyone’s name and how to say it.',
    next: ['Service without assumptions', 'How do I greet a table?'],
  },
  {
    id: 'respect',
    for: 'both',
    keys: ['left out', 'excluded', 'belong', 'bullied', 'bully', 'teased', 'mocked', 'joke about', 'my accent', 'new to the city', 'respect at work'],
    title: 'Respect in the team',
    answer:
      'Everyone on the team gets the same respect, whatever their language, accent, home state, religion, caste, gender, age or body. No jokes or nicknames about any of these, even “just for fun”. Help colleagues who are new to the city or the language. If you’re left out, teased or bullied, tell your manager; if it’s your manager, go to the owner or HR.',
    next: ['What do I do if someone harasses me?', 'The same welcome for every guest'],
  },
  {
    id: 'harassment',
    for: 'both',
    keys: ['harass', 'touched me', 'inappropriate', 'unsafe', 'creepy', 'sexual', 'posh', 'groped', 'stalk'],
    title: 'Harassment by a guest or colleague',
    answer:
      'You never have to put up with harassment from a guest or a colleague: comments about your body, unwanted touching, messages, or being followed. Step away and tell your manager straight away; they should take you off that table. You can make a formal complaint to the restaurant’s Internal Committee under India’s POSH Act, in confidence. Write down what happened and when.',
    next: ['What if a guest is rude?', 'Looking after yourself'],
  },
  // ——— For managers ———
  {
    id: 'm_brief',
    for: 'manager',
    keys: ['briefing', 'pre-shift', 'pre shift', 'line-up', 'lineup', 'huddle', 'before service', 'start of shift', 'brief the team'],
    title: 'The pre-shift briefing',
    answer:
      'Ten minutes, standing, same time every shift. Cover: covers and big bookings, allergies and access needs already known, occasions and VIPs, anything 86’d or new on the menu, section assignments, and one service focus for the night (“greet within 2 minutes”). Thank someone by name for something specific from last shift. End with “Any questions or worries?” and wait for an answer. Keep it in a language everyone follows; repeat key points in a second language if needed.',
    next: ['How do I give a server feedback?', 'We’re short-staffed tonight'],
  },
  {
    id: 'm_visit',
    for: 'manager',
    keys: ['complaint', 'wants the manager', 'asks for the manager', 'asked for the manager', 'speak to the manager', 'table visit', 'escalat', 'angry guest', 'guest complaint'],
    title: 'When a guest asks for you',
    answer:
      'Go within two minutes. Get the facts from the server first, quickly and away from the table. At the table: introduce yourself by name, listen without interrupting, apologise for the experience, and offer a concrete fix. Never blame the server or the kitchen in front of the guest. Afterwards, thank the server for bringing you in, and check how they are. Note what happened in the shift log.',
    next: ['When can I comp a dish?', 'Supporting staff after a hard guest'],
  },
  {
    id: 'm_comp',
    for: 'manager',
    keys: ['comp ', 'comped', 'complimentary', 'discount', 'refund', 'on the house', 'write off', 'waive', 'free dish', 'free dessert'],
    title: 'Comps and recovery',
    answer:
      'Fit the gesture to the problem: a remade dish for a quality issue, the dish off the bill if it ruined part of the meal, a dessert or drink for a long wait. Offer it, don’t make the guest ask. Decide quickly and consistently: the same problem gets the same response whoever the guest is. Record every comp with the reason, so you can fix the cause, not just the symptom.',
    next: ['When a guest asks for you', 'How do I run an end-of-shift debrief?'],
  },
  {
    id: 'm_feedback',
    for: 'manager',
    keys: ['feedback', 'underperform', 'performance', 'keeps missing', 'keeps making', 'talk to a server', 'correct a server', 'warning', 'not improving', 'coach a server'],
    title: 'Giving a server feedback',
    answer:
      'Privately, soon, and about the work, not the person. Use situation, behaviour, impact: “At T4 tonight (situation), the bill took 10 minutes after they asked (behaviour), and they mentioned it as they left (impact).” Then ask their view and listen; there’s often a reason, like a section that was too big. Agree one specific next step and when you’ll check in. Never correct someone in front of guests or the team. Praise in public, coach in private.',
    next: ['How do I recognise good work?', 'How do I use TableMate’s data fairly?'],
  },
  {
    id: 'm_praise',
    for: 'manager',
    keys: ['praise', 'recognis', 'recogniz', 'reward', 'thank the team', 'motivat', 'morale', 'appreciat'],
    title: 'Recognising good work',
    answer:
      'Be specific and quick: “Rohan, the way you spotted the nut allergy at T6 tonight kept a guest safe.” Spread recognition fairly across the team, including quieter people and back-of-house. Recognise teamwork and recoveries, not only speed. Team goals work better than leaderboards.',
    next: ['How do I give a server feedback?', 'The pre-shift briefing'],
  },
  {
    id: 'm_rush',
    for: 'manager',
    keys: ['rush', 'slammed', 'overload', 'rebalance', 'short staffed', 'short-staffed', 'no-show', 'called in sick', 'understaffed', 'busy night', 'sections'],
    title: 'Running a rush or a short shift',
    answer:
      'Look at load, not names: the Live floor shows tables and open tasks per section. Move the next seating to the lighter section, take a table or run food yourself, and pair a strong server with a newer one. Tell the kitchen early if you’re slowing seating. If you’re short-staffed, cap covers or stagger bookings rather than stretching people thin, and tell the team the plan in one sentence.',
    next: ['The pre-shift briefing', 'Floor and kitchen working together'],
  },
  {
    id: 'm_support',
    for: 'manager',
    keys: ['abused', 'shouted at', 'harassed by a guest', 'crying', 'support my staff', 'support a server', 'after an incident', 'staff upset', 'server upset'],
    title: 'Supporting staff after a hard guest',
    answer:
      'Take the server off that table straight away and handle the guest yourself. Give them a few minutes away from the floor, ask “Are you okay? What happened?”, and believe them. Make it clear it wasn’t their fault. Check in again at the end of the shift and the next day. If a guest harassed or threatened staff, you can refuse further service and ask them to leave.',
    next: ['Handling harassment reports', 'When a guest asks for you'],
  },
  {
    id: 'm_conflict',
    for: 'manager',
    keys: ['conflict', 'argue', 'argument', 'fight', 'dispute', 'tension', 'not getting along', 'clash between', 'tips'],
    title: 'Conflict in the team',
    answer:
      'Separate them for service, then talk after, first one at a time and then together. Listen to both sides without taking one. Focus on the work problem (tables, tips, side jobs) and agree a clear, fair rule so it doesn’t come back. If it involves harassment, bullying or discrimination, it isn’t a two-sided argument: follow the harassment process.',
    next: ['Respect in the team', 'Handling harassment reports'],
  },
  {
    id: 'm_emergency',
    for: 'manager',
    keys: ['allergic reaction', 'anaphyla', 'reaction', 'epipen', 'epi-pen', 'ambulance', 'choking', 'first aid', 'collapsed', 'emergency'],
    title: 'Allergic reaction or medical emergency',
    answer:
      'Act first, investigate later. Call 112 for an ambulance if there is any difficulty breathing, swelling of the face or throat, or collapse. Help the guest use their own adrenaline auto-injector if they have one; lay them down (sitting if breathing is hard). Stay with them, send someone to meet the ambulance, and keep the dish aside. Afterwards: write down exactly what was served and when, check the ticket and the allergy note, and debrief the team without blame.',
    next: ['How do I run an end-of-shift debrief?', 'Allergies'],
  },
  {
    id: 'm_onboard',
    for: 'manager',
    keys: ['new staff', 'new server', 'onboard', 'training plan', 'first week', 'new hire', 'buddy', 'new joiner'],
    title: 'Welcoming a new team member',
    answer:
      'Pair them with a buddy for the first week, ideally one who shares a language. Start with a smaller section and grow it. Ask how they learn best and what they need: some prefer to watch, some to read, some to try. Show them TableMate’s practice room and language settings on day one. Check in at the end of every shift that week, with one thing they did well and one to work on.',
    next: ['How do I give a server feedback?', 'Keeping the team inclusive'],
  },
  {
    id: 'm_inclusive',
    for: 'manager',
    keys: ['inclusive', 'inclusive team', 'diversity', 'diverse team', 'roster', 'rota', 'festival', 'eid', 'diwali', 'holiday', 'prayer', 'religious leave', 'childcare', 'disabled staff', 'accommodat', 'reasonable adjust', 'inclusion'],
    title: 'Keeping the team inclusive',
    answer:
      'Plan rosters fairly: rotate weekends and festivals so the same people don’t always miss Diwali, Eid or Christmas, and accept swaps. Make space for prayer, fasting and childcare where you can. Ask staff with disabilities what helps; it’s usually small (a stool, written notes, a quieter section). Use everyone’s correct name and pronouns. Hold briefings in a language everyone follows. Act on any joke or comment about caste, religion, region, gender, sexuality or disability the first time, quietly and firmly.',
    next: ['Respect in the team', 'Handling harassment reports'],
  },
  {
    id: 'm_posh',
    for: 'manager',
    keys: ['harassment complaint', 'posh', 'internal committee', 'report harassment', 'sexual harassment', 'complaint against'],
    title: 'Handling harassment reports',
    answer:
      'Take every report seriously and thank the person for telling you. Keep it confidential, make sure they’re safe (change sections or shifts for the other person, not them), and don’t investigate it yourself as a favour. Under India’s POSH Act, workplaces with 10 or more staff must have an Internal Committee; tell them how to reach it and help them file if they want to. Never retaliate against or discourage anyone who reports.',
    next: ['Supporting staff after a hard guest', 'Conflict in the team'],
  },
  {
    id: 'm_debrief',
    for: 'manager',
    keys: ['debrief', 'end of shift', 'after service', 'close down', 'review the night', 'post-shift', 'wrap up'],
    title: 'The end-of-shift debrief',
    answer:
      'Five minutes: what went well, what got stuck (use the Shift summary and delay receipts to see where time went), and one change for tomorrow. Talk about steps and stations, not people. Thank the team, including the kitchen. Note any comps, incidents and 86’d items for the next manager.',
    next: ['How do I use TableMate’s data fairly?', 'The pre-shift briefing'],
  },
  {
    id: 'm_data',
    for: 'manager',
    keys: ['data', 'dashboard', 'numbers', 'analytics', 'rank', 'compare staff', 'who is best', 'performance review', 'metrics', 'tablemate data', 'leaderboard'],
    title: 'Using TableMate’s data fairly',
    answer:
      'The console shows steps, stations and load, never individual scores, on purpose: a delay is attributed to whoever controlled that step, and kitchen delays are never a server’s. Use it to fix the system (sections too big, a slow station, bills stuck at a step), not to compare people. Each server sees their own stats privately; if you want to talk about someone’s work, ask them and use what you saw on the floor.',
    next: ['How do I give a server feedback?', 'Running a rush or a short shift'],
  },
  {
    id: 'm_kitchen',
    for: 'manager',
    keys: ['kitchen and floor', 'floor and kitchen', 'back of house', 'chef is', 'kitchen is slow', 'expo', 'front and back'],
    title: 'Floor and kitchen working together',
    answer:
      'Agree how notes travel: use the app’s kitchen notes for timings and 86s, and walk over for anything sensitive. When the kitchen is behind, tell the floor a realistic time, slow seating, and give servers the words for guests. Never let blame fly across the pass in front of guests. Debrief together and thank the kitchen out loud.',
    next: ['Running a rush or a short shift', 'The end-of-shift debrief'],
  },
]

/** Lessons written for this audience (inclusion lessons are for both). */
export function lessonsFor(audience: Audience): Lesson[] {
  return LESSONS.filter((l) => (l.for ?? 'server') === audience || l.for === 'both')
}

/** Pick the lessons that best match a question, from the ones written for this audience. */
export function findLessons(question: string, limit = 2, audience: Audience = 'server'): Lesson[] {
  const q = ` ${question.toLowerCase()} `
  return lessonsFor(audience)
    // A follow-up chip often is a lesson's own title ("Looking after yourself"): that's the best match.
    .map((l) => ({ l, score: (q.includes(l.title.toLowerCase()) ? 5 : 0) + l.keys.reduce((n, k) => n + (q.includes(k) ? (k.includes(' ') ? 2 : 1) : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.l)
}

export const STARTERS = ['Brief me on my section', 'How do I handle a complaint?', 'What’s in the galouti kebab?', 'Explain Jain food', 'How do I recommend dishes?']

/** Opening questions for managers (same order as the app's chat.m1–m5). */
export const MANAGER_STARTERS = ['Plan my pre-shift briefing', 'A guest wants the manager. What do I do?', 'How do I give a server feedback?', 'We’re short-staffed tonight', 'How do I keep the team inclusive?']
