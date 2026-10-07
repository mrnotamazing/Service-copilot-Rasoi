// What staff can customise about themselves, and the checks the server applies.
// Everything here is chosen by the person and visible to teammates; nothing is required.

/** Avatar colours. White text and icons stay readable on each. */
export const AVATAR_COLORS = ['#c4442a', '#e07a5f', '#a85d0c', '#2f7d5b', '#3d9a8b', '#2d6fb5', '#8d6cd1', '#b8407a', '#5c6b7a', '#34251d']

/** Illustrated avatars (drawn as vector icons on the client). */
export const AVATAR_ICONS = ['chef', 'star', 'leaf', 'flame', 'coffee', 'wine', 'cherry', 'croissant', 'fish', 'heart', 'moon', 'sun', 'music', 'flower', 'cat', 'dog']

/** Languages a person can say they speak, in their own script. */
export const SPOKEN: { id: string; native: string }[] = [
  { id: 'en', native: 'English' },
  { id: 'hi', native: 'हिन्दी' },
  { id: 'ne', native: 'नेपाली' },
  { id: 'bn', native: 'বাংলা' },
  { id: 'ta', native: 'தமிழ்' },
  { id: 'te', native: 'తెలుగు' },
  { id: 'kn', native: 'ಕನ್ನಡ' },
  { id: 'ml', native: 'മലയാളം' },
  { id: 'mr', native: 'मराठी' },
  { id: 'gu', native: 'ગુજરાતી' },
  { id: 'pa', native: 'ਪੰਜਾਬੀ' },
  { id: 'ur', native: 'اردو' },
  { id: 'es', native: 'Español' },
  { id: 'fr', native: 'Français' },
  { id: 'ar', native: 'العربية' },
  { id: 'zh', native: '中文' },
]

/** Small photos only: the client crops and shrinks before upload. */
export const MAX_PHOTO_CHARS = 60_000

export interface ProfilePatch {
  name?: string
  pronouns?: string
  color?: string
  avatar?: string
  languages?: string[]
}

/** Keeps only valid fields from an untrusted request body. Returns an error message for bad input. */
export function cleanProfile(body: Record<string, unknown>): ProfilePatch | string {
  const out: ProfilePatch = {}
  if (typeof body.name === 'string') {
    // eslint-disable-next-line no-control-regex
    const name = body.name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24)
    if (!name) return 'Name can’t be empty.'
    out.name = name
  }
  if (typeof body.pronouns === 'string') out.pronouns = body.pronouns.trim().slice(0, 24)
  if (typeof body.color === 'string') {
    if (!AVATAR_COLORS.includes(body.color)) return 'Pick one of the colours shown.'
    out.color = body.color
  }
  if (typeof body.avatar === 'string') {
    const a = body.avatar
    const ok = a === '' || (a.startsWith('icon:') && AVATAR_ICONS.includes(a.slice(5))) || (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(a) && a.length <= MAX_PHOTO_CHARS)
    if (!ok) return 'That picture couldn’t be used. Try a smaller photo.'
    out.avatar = a
  }
  if (Array.isArray(body.languages)) out.languages = [...new Set(body.languages.filter((l): l is string => typeof l === 'string' && SPOKEN.some((s) => s.id === l)))].slice(0, 8)
  return out
}
