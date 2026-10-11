import { Link } from 'react-router-dom'
import Page from '../components/Page'

export default function Import() {
  return (
    <Page title="Add a recipe">
      <div className="card">
        <h2>Type or paste</h2>
        <p>Paste the ingredient list and steps from anywhere, or type them in.</p>
        <Link className="btn" to="/recipe/new">
          Add a recipe
        </Link>
      </div>
      <div className="card">
        <h2>From a screenshot, PDF, or link</h2>
        <p className="hint">Coming in the next build step.</p>
      </div>
    </Page>
  )
}
