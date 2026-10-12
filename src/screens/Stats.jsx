import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { db } from '../lib/db'
import { localDate } from '../lib/data'
import { computeStats, MILESTONES } from '../lib/stats'

const timeText = (hours) => {
  if (hours < 1) return { value: Math.round(hours * 60), unit: 'min' }
  return { value: Math.round(hours * 10) / 10, unit: hours < 1.05 ? 'hour' : 'hours' }
}
const shortDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const percent = (part, whole) => `${Math.round((part / whole) * 100)}%`
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

// Meals per week as columns. The drawing is hidden from screen readers;
// the same numbers are in a table for them.
function WeeklyChart({ weeks }) {
  const width = 320
  const height = 132
  const top = 18 // room for value labels
  const bottom = 22 // room for dates
  const plot = height - top - bottom
  const max = Math.max(1, ...weeks.map((w) => w.count))
  const slot = width / weeks.length
  const bar = Math.min(24, slot - 12)
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" aria-hidden="true" focusable="false">
        <line x1="0" x2={width} y1={top + plot + 0.5} y2={top + plot + 0.5} className="chart-axis" />
        {weeks.map((week, i) => {
          const x = i * slot + (slot - bar) / 2
          const h = Math.max(8, (week.count / max) * plot)
          const label = `Week of ${shortDay.format(week.start)}: ${week.count} ${week.count === 1 ? 'meal' : 'meals'}`
          return (
            <g key={week.start.toISOString()}>
              <title>{label}</title>
              {week.count > 0 && (
                <>
                  <path className="chart-bar" d={`M${x},${top + plot} v${-(h - 4)} q0,-4 4,-4 h${bar - 8} q4,0 4,4 v${h - 4} z`} />
                  <text x={x + bar / 2} y={top + plot - h - 5} textAnchor="middle" className="chart-value">
                    {week.count}
                  </text>
                </>
              )}
              {(weeks.length - 1 - i) % 2 === 0 && (
                <text x={x + bar / 2} y={height - 6} textAnchor="middle" className="chart-tick">
                  {i === weeks.length - 1 ? 'This wk' : shortDay.format(week.start)}
                </text>
              )}
            </g>
          )
        })}
      </svg>
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

const ICONS = {
  meals: <path d="M9 3v7a2 2 0 0 0 4 0V3M11 10v11M17 3c-1.7 0-3 2-3 5s1.3 4 3 4v9" />,
  cuisines: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </>
  ),
  hours: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
}
const UNIT = { meals: 'meals', cuisines: 'cuisines', hours: 'hours' }

// Earned milestones as filled badges; the next one on each track as an
// outlined badge with how close you are.
function Badges({ stats }) {
  const badges = MILESTONES.flatMap(({ kind }) => {
    const earned = stats.milestones.filter((m) => m.kind === kind && m.reached)
    const next = stats.next.find((m) => m.kind === kind)
    return [...earned.map((m) => ({ ...m, earned: true })), ...(next ? [{ ...next, earned: false }] : [])]
  })
  return (
    <ul className="badges">
      {badges.map((badge) => {
        const current = badge.kind === 'hours' ? Math.floor(badge.current * 10) / 10 : badge.current
        return (
          <li key={`${badge.kind}-${badge.threshold}`} className={badge.earned ? 'badge is-earned' : 'badge'}>
            <span className="badge-medal" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="22"
                height="22"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {ICONS[badge.kind]}
              </svg>
              <span className="badge-number">{badge.threshold}</span>
            </span>
            <span className="badge-label">
              <span className="sr-only">{badge.earned ? 'Earned: ' : 'Next: '}</span>
              {badge.label}
            </span>
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

// Each item's share of all meals, as a thin meter. The numbers are in the text.
function ShareList({ items, total, label }) {
  return (
    <ul className="share-list">
      {items.map((item) => (
        <li key={item.name}>
          <span className="row-between">
            <span>{label ? label(item) : item.name}</span>
            <span className="share-count">
              {item.count} · {percent(item.count, total)}
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

export default function Stats() {
  const stats = useLiveQuery(async () => {
    const [recipes, ingredients, cookLog, ratings] = await Promise.all([
      db.recipes.toArray(),
      db.ingredients.toArray(),
      db.cook_log.toArray(),
      db.ratings.toArray(),
    ])
    return computeStats({ recipes, ingredients, cookLog, ratings, today: localDate() })
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
        <p className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
          Time counts each recipe's total time once per meal.
          {stats.mealsWithoutTime > 0 &&
            ` ${stats.mealsWithoutTime} ${stats.mealsWithoutTime === 1 ? "meal doesn't" : "meals don't"} count because the recipe has no total time.`}
        </p>
      </section>

      <section aria-labelledby="badges-heading">
        <h2 id="badges-heading">Badges</h2>
        <Badges stats={stats} />
      </section>

      <section aria-labelledby="weeks-heading">
        <h2 id="weeks-heading">Meals by week</h2>
        <WeeklyChart weeks={stats.weeks} />
      </section>

      <section aria-labelledby="most-made-heading">
        <h2 id="most-made-heading">Most made</h2>
        <ShareList
          items={stats.mostMade.map((r) => ({ name: r.id, count: r.count, title: r.title }))}
          total={stats.mealsLogged}
          label={(item) => <Link to={`/recipe/${item.name}`}>{item.title}</Link>}
        />
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
        <ShareList items={stats.mealTypes} total={stats.mealsLogged} label={(item) => capitalize(item.name)} />
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
          <p className="hint">How many meals each was in, leaving out salt, pepper, and water.</p>
        </section>
      )}
    </Page>
  )
}
