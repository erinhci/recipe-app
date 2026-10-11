import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { db } from '../lib/db'
import { computeStats } from '../lib/stats'

const hoursText = (hours) => {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`
  const rounded = Math.round(hours * 10) / 10
  return `${rounded} ${rounded === 1 ? 'hour' : 'hours'}`
}

// A labeled count with a bar sized against the top count. The bar is
// decoration; the number is in the text.
function CountList({ items, label }) {
  const top = items[0]?.count ?? 1
  return (
    <ul className="plain-list">
      {items.map((item) => (
        <li key={item.name} style={{ marginBottom: 'var(--space-3)' }}>
          <div className="row-between">
            <span>{label ? label(item) : item.name}</span>
            <span>{item.count}</span>
          </div>
          <div className="bar" aria-hidden="true" style={{ width: `${(item.count / top) * 100}%` }} />
        </li>
      ))}
    </ul>
  )
}

export default function Stats() {
  const stats = useLiveQuery(async () => {
    const [recipes, ingredients, cookLog, ratings, sessions] = await Promise.all([
      db.recipes.toArray(),
      db.ingredients.toArray(),
      db.cook_log.toArray(),
      db.ratings.toArray(),
      db.cooking_sessions.toArray(),
    ])
    return computeStats({ recipes, ingredients, cookLog, ratings, sessions })
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
        <p>No meals logged yet. When you finish cooking a recipe, or tap "We made this" on its page, it shows up here.</p>
        <Link className="btn" to="/">
          Go to Library
        </Link>
      </Page>
    )
  }

  const reached = stats.milestones.filter((m) => m.reached)

  return (
    <Page title="Stats">
      <section aria-labelledby="totals-heading" className="card">
        <h2 id="totals-heading" className="sr-only">
          Totals
        </h2>
        <ul style={{ margin: 0, paddingLeft: 'var(--space-6)' }}>
          <li>
            {stats.mealsLogged} {stats.mealsLogged === 1 ? 'meal' : 'meals'} cooked ({stats.recipesCooked}{' '}
            {stats.recipesCooked === 1 ? 'recipe' : 'different recipes'})
          </li>
          <li>{hoursText(stats.hours)} cooking together</li>
          <li>
            {stats.cuisinesTried} {stats.cuisinesTried === 1 ? 'cuisine' : 'cuisines'} tried
          </li>
        </ul>
        <p className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
          Time comes from cooking mode, or from minutes added in a recipe's cook log, up to 4 hours a session. When you both record the same cook, it counts once.
        </p>
      </section>

      <section aria-labelledby="milestones-heading">
        <h2 id="milestones-heading">Milestones</h2>
        {reached.length > 0 && (
          <ul>
            {reached.map((m) => (
              <li key={`${m.kind}-${m.threshold}`}>{m.label}</li>
            ))}
          </ul>
        )}
        {stats.next.length > 0 && (
          <>
            <h3>Up next</h3>
            <ul>
              {stats.next.map((m) => (
                <li key={m.kind}>
                  {m.label}: {m.kind === 'hours' ? `${Math.floor(m.current * 10) / 10}` : m.current} of {m.threshold}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="most-made-heading">
        <h2 id="most-made-heading">Most made</h2>
        <CountList
          items={stats.mostMade.map((r) => ({ name: r.id, count: r.count, title: r.title }))}
          label={(item) => <Link to={`/recipe/${item.name}`}>{item.title}</Link>}
        />
      </section>

      {stats.topRated.length > 0 && (
        <section aria-labelledby="top-rated-heading">
          <h2 id="top-rated-heading">Top rated</h2>
          <p className="hint">Each of your latest ratings, averaged.</p>
          <ol>
            {stats.topRated.map((r) => (
              <li key={r.id} style={{ marginBottom: 'var(--space-2)' }}>
                <Link to={`/recipe/${r.id}`}>{r.title}</Link>, {Math.round(r.average * 10) / 10}★
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="cuisines-heading">
        <h2 id="cuisines-heading">Cuisines</h2>
        <CountList items={stats.cuisines} />
      </section>

      <section aria-labelledby="meal-types-heading">
        <h2 id="meal-types-heading">Meal types</h2>
        <CountList items={stats.mealTypes} label={(item) => item.name[0].toUpperCase() + item.name.slice(1)} />
      </section>

      {stats.topIngredients.length > 0 && (
        <section aria-labelledby="ingredients-heading">
          <h2 id="ingredients-heading">Top ingredients</h2>
          <p className="hint">How many meals each was in. Leaves out salt, pepper, and water.</p>
          <CountList items={stats.topIngredients} />
        </section>
      )}
    </Page>
  )
}
