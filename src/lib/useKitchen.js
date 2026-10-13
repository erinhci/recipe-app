import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db.js'
import { computeStats } from './stats.js'
import { localDate } from './data.js'
import { colorsFor, earnedKeys, kitchenScene, wornAvatar } from './avatars.js'

// The kitchen's people as the screens draw them: each active cook with
// their color and what their avatar wears, you first, plus the shared
// scene and which badges are earned. From this phone's copy, so it shows
// offline. undefined while loading.
export function useKitchenPeople(userId) {
  return useLiveQuery(async () => {
    const [members, kitchens, recipes, ingredients, cookLog, ratings] = await Promise.all([
      db.members.toArray(),
      db.kitchens.toArray(),
      db.recipes.toArray(),
      db.ingredients.toArray(),
      db.cook_log.toArray(),
      db.ratings.toArray(),
    ])
    const stats = computeStats({ recipes, ingredients, cookLog, ratings, today: localDate() })
    const earned = earnedKeys(stats)
    const colors = colorsFor(members)
    const byUser = new Map(members.filter((m) => !m.removed_at).map((m) => [m.user_id, m]))
    const cooks = [...byUser.values()]
      .sort((a, b) => (b.user_id === userId) - (a.user_id === userId))
      .map((m) => ({ ...m, name: m.display_name, color: colors[m.user_id], look: wornAvatar(m, earned), isMe: m.user_id === userId }))
    const me = cooks.find((c) => c.isMe) ?? null
    const kitchen = kitchens.find((k) => k.id === (me?.kitchen_id ?? kitchens[0]?.id)) ?? null
    return {
      cooks,
      me,
      partner: cooks.find((c) => !c.isMe) ?? null,
      byUser: Object.fromEntries(cooks.map((c) => [c.user_id, c])),
      kitchen,
      ...kitchenScene(kitchen, earned),
      earned,
      stats,
    }
  }, [userId])
}
