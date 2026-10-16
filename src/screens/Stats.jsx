import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/Icon'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { db } from '../lib/db'
import { localDate } from '../lib/data'
import { computeStats, MILESTONES } from '../lib/stats'
import { rewardFor } from '../lib/avatars'
import Avatar from '../components/Avatar'
import BadgeIcon from '../components/BadgeIcon'
import { PhotoImg } from '../components/MealPhotos'
import { newestFirst } from '../lib/photos'

const timeText = (hours) => {
  if (hours < 1) return { value: Math.round(hours * 60), unit: 'min' }
  return { value: Math.round(hours * 10) / 10, unit: hours < 1.05 ? 'hour' : 'hours' }
}
const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const percent = (part, whole) => `${Math.round((part / Math.max(1, whole)) * 100)}%`
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

// The three headline numbers, as stat tiles.
function Tiles({ stats }) {
  const time = timeText(stats.hours)
  const tiles = [
    {
      label: stats.mealsLogged === 1 ? 'Meal cooked' : 'Meals cooked',
      value: stats.mealsLogged,
      note: `${stats.recipesCooked} ${stats.recipesCooked === 1 ? 'recipe' : 'recipes'}`,
    },
    { label: 'Cooking together', value: time.value, unit: time.unit },
    { label: stats.cuisinesTried === 1 ? 'Cuisine tried' : 'Cuisines tried', value: stats.cuisinesTried },
  ]
  return (
    <ul className="stat-tiles">
      {tiles.map((tile) => (
        <li key={tile.label} className="stat-tile">
          <span className="stat-value">
            {tile.value}
            {tile.unit && <span className="stat-unit"> {tile.unit}</span>}
          </span>
          <span className="stat-label">{tile.label}</span>
          {tile.note && <span className="stat-note">{tile.note}</span>}
        </li>
      ))}
    </ul>
  )
}

// Meals per week as a line, oldest first, with every week labeled. Weeks
// with meals get a filled dot and the count above it; weeks with none get
// a hollow dot on the baseline. The drawing is hidden from screen readers;
// the same numbers are in a table for them.
export function WeeklyChart({ weeks }) {
  const max = Math.max(1, ...weeks.map((w) => w.count))
  const x0 = 28
  const x1 = 322
  const top = 22
  const base = 112
  const points = weeks.map((week, i) => ({
    week,
    x: x0 + (i * (x1 - x0)) / Math.max(1, weeks.length - 1),
    y: base - (week.count / max) * (base - top),
  }))
  const line = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `M${x0} ${base} L${points.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L')} L${points.at(-1)?.x.toFixed(1)} ${base}Z`
  return (
    <figure className="chart">
      <svg viewBox="0 0 350 118" width="100%" aria-hidden="true" focusable="false" className="line-chart">
        <path d="M12 112 H338" className="chart-axis" />
        <path d={area} className="chart-area" />
        <polyline points={line} className="chart-line" />
        {points.map(({ week, x, y }) => (
          <g key={week.start.toISOString()}>
            <circle cx={x} cy={y} r={week.count ? 4.5 : 3.5} className={week.count ? 'chart-dot' : 'chart-dot is-empty'} />
            {week.count > 0 && (
              <text x={x} y={y - 10} textAnchor="middle" className="chart-value">
                {week.count}
              </text>
            )}
          </g>
        ))}
      </svg>
      <div className="chart-weeks" aria-hidden="true">
        {weeks.map((week, i) => (
          <span key={week.start.toISOString()}>{i === weeks.length - 1 ? 'This wk' : shortDay.format(week.start)}</span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Meals cooked each week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Meals</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.start.toISOString()}>
              <td>{shortDay.format(week.start)}</td>
              <td>{week.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

// Each share of all meals as a pie, starting at the top and going
// clockwise in the legend's order. Slices go from dark to light and are
// outlined, and the legend gives each count and share, so nothing depends
// on telling shades apart. The pie is hidden from screen readers; they
// read the legend.
const SHADES = [1, 0.6, 0.3, 0.08, 0.45, 0.18]
export function PieChart({ items, total, label = (item) => item.name }) {
  const r = 66
  let angle = -90
  const slices = items.map((item, i) => {
    const sweep = (360 * item.count) / Math.max(1, total)
    const a0 = (angle * Math.PI) / 180
    angle += sweep
    const a1 = (angle * Math.PI) / 180
    const shade = SHADES[i % SHADES.length]
    // A single slice is the whole circle.
    const d =
      sweep >= 359.99
        ? `M70 4 A${r} ${r} 0 1 1 69.99 4 Z`
        : `M70 70 L${(70 + r * Math.cos(a0)).toFixed(1)} ${(70 + r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${(70 + r * Math.cos(a1)).toFixed(1)} ${(70 + r * Math.sin(a1)).toFixed(1)} Z`
    return { item, d, shade }
  })
  return (
    <div className="pie">
      <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true" focusable="false">
        {slices.map(({ item, d, shade }) => (
          <path key={item.name} d={d} className="pie-slice" style={{ fillOpacity: shade }} />
        ))}
        <circle cx="70" cy="70" r={r} className="pie-rim" />
      </svg>
      <ul className="pie-legend">
        {slices.map(({ item, shade }) => (
          <li key={item.name}>
            <span className="pie-key" aria-hidden="true">
              <span style={{ opacity: shade }} />
            </span>
            <span className="pie-text">
              <span>{label(item)}</span>
              <span className="share-count">
                {item.count} {item.count === 1 ? 'meal' : 'meals'} · {percent(item.count, total)}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// The most made recipes as tiles: the latest meal photo (or the first
// letter when there's no photo yet, as in Library) and how often it's
// been made.
export function MostMade({ items }) {
  return (
    <ul className="most-made">
      {items.map((r) => (
        <li key={r.id}>
          <Link to={`/recipe/${r.id}`} aria-label={`${r.title}, made ${r.count} ${r.count === 1 ? 'time' : 'times'}`}>
            {r.photo ? (
              <PhotoImg photo={r.photo} alt="" className="most-made-photo" />
            ) : (
              <span className="most-made-photo is-empty" aria-hidden="true">
                {r.title.trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className="most-made-title">{r.title}</span>
            <span className="most-made-count">Made {r.count}×</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

const UNIT = { joined: '', meals: 'meals', cuisines: 'cuisines', hours: 'hours', together: 'two-chef cooks', rated: 'recipes rated' }

// Earned milestones as filled badges; the next one on each track as an
// outlined badge with how close you are.
function allBadges(stats) {
  return MILESTONES.flatMap(({ kind }) => {
    const earned = stats.milestones.filter((m) => m.kind === kind && m.reached)
    const next = stats.next.find((m) => m.kind === kind)
    return [...earned.map((m) => ({ ...m, earned: true })), ...(next ? [{ ...next, earned: false }] : [])]
  })
}

// The row on Stats: the two most recent earned badges and the closest one
// to earning, linking to all of them.
function badgeRow(stats) {
  const all = allBadges(stats)
  const earned = all.filter((b) => b.earned).slice(-2)
  const next = all
    .filter((b) => !b.earned)
    .sort((a, b) => b.current / b.threshold - a.current / a.threshold)
    .slice(0, 3 - earned.length)
  return [...earned, ...next]
}

// showRewards: add what each badge unlocks for the avatars (Badges page).
// large: bigger medals (the Badges page and its Next up card).
export function Badges({ badges, showRewards = false, large = showRewards }) {
  return (
    <ul className={large ? 'badges is-large' : 'badges'}>
      {badges.map((badge) => {
        const current = badge.kind === 'hours' ? Math.floor(badge.current * 10) / 10 : badge.current
        return (
          <li key={`${badge.kind}-${badge.threshold}`} className={badge.earned ? 'badge is-earned' : 'badge'}>
            <span className="badge-medal" aria-hidden="true">
              <BadgeIcon kind={badge.kind} size={large ? 28 : 22} />
              <span className="badge-number">{badge.threshold}</span>
            </span>
            <span className="badge-label">
              <span className="sr-only">{badge.earned ? 'Earned: ' : 'Next: '}</span>
              {badge.label}
            </span>
            {showRewards && rewardFor(badge) && (
              <span className="badge-reward">
                {badge.earned ? 'Unlocked: ' : 'Unlocks: '}
                {rewardFor(badge).label}
              </span>
            )}
            {!badge.earned && (
              <>
                <span className="meter" aria-hidden="true">
                  <span style={{ width: `${Math.min(100, (badge.current / badge.threshold) * 100)}%` }} />
                </span>
                <span className="badge-progress">
                  {current} of {badge.threshold}
                  <span className="sr-only"> {UNIT[badge.kind]}</span>
                </span>
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// Each item's share of all meals, as a thin meter. The text gives the
// count, not a percentage.
function ShareList({ items, total, label, countText = (n) => `${n} ${n === 1 ? 'meal' : 'meals'}` }) {
  return (
    <ul className="share-list">
      {items.map((item) => (
        <li key={item.name}>
          <span className="row-between">
            <span>{label ? label(item) : item.name}</span>
            <span className="share-count">
              {countText(item.count)}
            </span>
          </span>
          <span className="meter" aria-hidden="true">
            <span style={{ width: percent(item.count, total) }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function badgeSummary(stats) {
  const all = allBadges(stats)
  const earned = all.filter((b) => b.earned).length
  const next = badgeRow(stats).find((b) => !b.earned)
  return `Badges: ${earned} earned.${next ? ` Next, ${next.label}, ${Math.floor(next.current)} of ${next.threshold}.` : ''} See all.`
}

// Which meals aren't in the hours yet, and a way to fix each: open the
// recipe's edit screen at its times. It can be closed; it comes back if
// the number changes.
function MissingTime({ stats }) {
  const key = 'stats-missing-time-dismissed'
  const count = stats.mealsWithoutTime
  const [dismissed, setDismissed] = useState(() => {
    try {
      return Number(localStorage.getItem(key)) === count
    } catch {
      return false
    }
  })
  if (count === 0 || dismissed) return null
  function dismiss() {
    try {
      localStorage.setItem(key, String(count))
    } catch {
      // Not remembered; it just closes for now.
    }
    setDismissed(true)
  }
  const title = `${count} ${count === 1 ? "meal isn't" : "meals aren't"} in the hours yet`
  return (
    <div className="missing-time">
      <details open>
        <summary>{title}</summary>
        <p className="hint" style={{ margin: '0 0 var(--space-1)' }}>
          Hours come from each recipe's prep and cook times. Add the time and its meals count.
        </p>
        <ul className="plain-list divided" style={{ marginTop: 0 }}>
          {stats.untimedRecipes.map((r) => (
            <li key={r.id}>
              <span>
                {r.title}{' '}
                <span className="hint">
                  · {r.meals} {r.meals === 1 ? 'meal' : 'meals'}
                </span>
              </span>
              <Link className="small-link" to={`/recipe/${r.id}/edit`} aria-label={`Add cook time to ${r.title}`}>
                Add cook time
              </Link>
            </li>
          ))}
        </ul>
      </details>
      <button className="close-btn missing-time-close" type="button" aria-label={`Dismiss: ${title}`} onClick={dismiss}>
        <Icon name="close" size={20} />
      </button>
    </div>
  )
}

// Every badge, earned and next, opened from the row on Stats. The closest
// badge with a reward leads, with a preview of what it unlocks.
export function BadgesPage() {
  const stats = useLiveQuery(async () => {
    const [recipes, ingredients, cookLog, ratings] = await Promise.all([
      db.recipes.toArray(),
      db.ingredients.toArray(),
      db.cook_log.toArray(),
      db.ratings.toArray(),
    ])
    return computeStats({ recipes, ingredients, cookLog, ratings, today: localDate() })
  }, [])
  const all = stats ? allBadges(stats) : []
  const earnedCount = all.filter((b) => b.earned).length
  const nextUp = all
    .filter((b) => !b.earned && rewardFor(b))
    .sort((a, b) => b.current / b.threshold - a.current / a.threshold)[0]
  return (
    <Page title="Badges" back={{ to: '/stats', label: 'Stats' }}>
      {stats === undefined ? (
        <p role="status">Loading…</p>
      ) : (
        <>
          <p className="hint">{earnedCount} earned. Badges unlock outfits, hats, poses and scenes for your avatars in Settings.</p>
          {nextUp && <NextUp badge={nextUp} />}
          <h2>Earned</h2>
          <Badges badges={all.filter((b) => b.earned)} showRewards />
          <h2 className="subheading">Still to earn</h2>
          <Badges badges={all.filter((b) => !b.earned)} showRewards />
        </>
      )}
    </Page>
  )
}

// "Next up": how far to go, and a picture of the reward.
function NextUp({ badge }) {
  const reward = rewardFor(badge)
  const left = badge.kind === 'hours' ? Math.ceil((badge.threshold - badge.current) * 10) / 10 : badge.threshold - badge.current
  const unit = { meals: left === 1 ? 'meal' : 'meals', cuisines: left === 1 ? 'cuisine' : 'cuisines', hours: left === 1 ? 'hour' : 'hours', together: left === 1 ? 'two-chef cook' : 'two-chef cooks', rated: left === 1 ? 'recipe to rate' : 'recipes to rate' }[badge.kind]
  const preview = { outfit: { outfit: reward.id }, hat: { hat: reward.id } }[reward.type]
  return (
    <section className="next-up" aria-labelledby="next-up-title">
      <Badges badges={[badge]} large />
      <div className="next-up-text">
        <span className="eyebrow">Next up</span>
        <p id="next-up-title" className="next-up-title">
          {left} more {unit}
        </p>
        <p className="next-up-reward">
          {preview && <Avatar size={64} {...preview} />}
          Unlocks the {reward.label.charAt(0).toLowerCase() + reward.label.slice(1)}
        </p>
      </div>
    </section>
  )
}

export default function Stats() {
  const stats = useLiveQuery(async () => {
    const [recipes, ingredients, cookLog, ratings, photos] = await Promise.all([
      db.recipes.toArray(),
      db.ingredients.toArray(),
      db.cook_log.toArray(),
      db.ratings.toArray(),
      db.meal_photos.toArray(),
    ])
    const stats = computeStats({ recipes, ingredients, cookLog, ratings, today: localDate() })
    const latest = new Map()
    for (const photo of newestFirst(photos)) if (!latest.has(photo.recipe_id)) latest.set(photo.recipe_id, photo)
    // Three tiles fit across.
    return { ...stats, mostMade: stats.mostMade.slice(0, 3).map((r) => ({ ...r, photo: latest.get(r.id) })) }
  }, [])

  if (stats === undefined) {
    return (
      <Page title="Stats">
        <p role="status">Loading…</p>
      </Page>
    )
  }

  if (stats.mealsLogged === 0) {
    return (
      <Page title="Stats">
        <p>No meals logged yet. When you finish a recipe in cooking mode, or add it to the cook log on its page, it shows up here.</p>
        <Link className="btn" to="/">
          Go to Library
        </Link>
      </Page>
    )
  }

  return (
    <Page title="Stats">
      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading" className="sr-only">
          Totals
        </h2>
        <Tiles stats={stats} />
        <MissingTime stats={stats} />
      </section>

      <section aria-labelledby="badges-heading">
        <div className="row-between">
          <h2 id="badges-heading" style={{ margin: 0 }}>
            Badges
          </h2>
          <Link className="small-link" to="/badges">
            See all {allBadges(stats).length} badges
          </Link>
        </div>
        <Link className="badge-row" to="/badges" aria-label={badgeSummary(stats)}>
          <Badges badges={badgeRow(stats)} />
        </Link>
      </section>

      <section aria-labelledby="weeks-heading">
        <h2 id="weeks-heading">Meals by week</h2>
        <WeeklyChart weeks={stats.weeks} />
      </section>

      <section aria-labelledby="most-made-heading">
        <h2 id="most-made-heading">Most made</h2>
        <MostMade items={stats.mostMade} />
      </section>

      {stats.topRated.length > 0 && (
        <section aria-labelledby="top-rated-heading">
          <h2 id="top-rated-heading">Top rated</h2>
          <ol className="plain-list divided ranked">
            {stats.topRated.map((r) => (
              <li key={r.id}>
                <Link to={`/recipe/${r.id}`}>{r.title}</Link>
                <span className="share-count">
                  {Math.round(r.average * 10) / 10}
                  <span aria-hidden="true">★</span>
                  <span className="sr-only"> stars</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="hint">Your latest ratings, averaged.</p>
        </section>
      )}

      <section aria-labelledby="cuisines-heading">
        <h2 id="cuisines-heading">Cuisines</h2>
        <ShareList items={stats.cuisines} total={stats.mealsLogged} />
      </section>

      <section aria-labelledby="meal-types-heading">
        <h2 id="meal-types-heading">Meal types</h2>
        <PieChart items={stats.mealTypes} total={stats.mealsLogged} label={(item) => capitalize(item.name)} />
      </section>

      {stats.topIngredients.length > 0 && (
        <section aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading">Top ingredients</h2>
          <ul className="chips">
            {stats.topIngredients.map((item) => (
              <li key={item.name}>
                {item.name}
                <span className="chip-count">
                  <span className="sr-only">, in </span>
                  {item.count}
                  <span className="sr-only"> {item.count === 1 ? 'meal' : 'meals'}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="hint">Meals each was in.</p>
        </section>
      )}
    </Page>
  )
}
