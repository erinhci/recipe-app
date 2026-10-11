import Page from '../components/Page'

// Placeholder for screens still being built.
export default function ComingSoon({ title, description }) {
  return (
    <Page title={title}>
      <p>{description}</p>
      <p className="hint">This screen is coming in the next build step.</p>
    </Page>
  )
}
