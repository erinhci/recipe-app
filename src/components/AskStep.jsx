import { useEffect, useId, useState } from 'react'
import Working from './Working'
import { askStep } from '../lib/askStep'
import { ingredientLine, scaledStepString } from '../lib/cooking'
import { fetchQuestions, savedQuestions } from '../lib/stepQuestions'

// "Ask about this step": tap a likely question for the step, or type your
// own. Gemini answers for this recipe at the amounts shown. Answers stay
// with the step they were asked on.
export default function AskStep({ recipe, steps, ingredients, factor, system, servings, stepIndex, online }) {
  const [answers, setAnswers] = useState({}) // step index -> [{ question, answer, error }]
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [suggested, setSuggested] = useState(null) // one list per step
  const id = useId()
  const stepAnswers = answers[stepIndex] ?? []

  // Saved suggestions first; fetched once when there are none.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const saved = await savedQuestions(recipe.id, steps)
      if (saved) {
        if (!cancelled) setSuggested(saved)
        return
      }
      if (!navigator.onLine) return
      const fetched = await fetchQuestions(
        recipe,
        steps,
        ingredients.map((ing) => ingredientLine(ing, 1, system)),
      )
      if (!cancelled && fetched) setSuggested(fetched)
    })()
    return () => {
      cancelled = true
    }
    // Only when the recipe or its steps change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe.id, steps.map((s) => s.text).join('\n')])

  async function ask(text) {
    if (!text || asking) return
    setAsking(true)
    const result = await askStep({
      recipe,
      servings,
      ingredientLines: ingredients.map((ing) => ingredientLine(ing, factor, system)),
      steps: steps.map((s) => ({ ...s, text: scaledStepString(s.text, ingredients, factor, system) })),
      stepNumber: stepIndex + 1,
      question: text,
    })
    setAnswers((all) => ({
      ...all,
      [stepIndex]: [...(all[stepIndex] ?? []), { question: text, answer: result.answer, error: result.ok ? null : result.message }],
    }))
    if (result.ok && text === question.trim()) setQuestion('')
    setAsking(false)
  }

  const asked = new Set(stepAnswers.map((a) => a.question))
  const chips = (suggested?.[stepIndex] ?? []).filter((q) => !asked.has(q))

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Ask about step {stepIndex + 1}</h2>
      <div aria-live="polite">
        {stepAnswers.map((item, index) => (
          <div key={index} className="answer">
            <p style={{ fontWeight: 600 }}>{item.question}</p>
            {item.error ? <p className="error">{item.error}</p> : <p style={{ margin: 0 }}>{item.answer}</p>}
          </div>
        ))}
      </div>
      {online && chips.length > 0 && (
        <ul className="question-chips" aria-label="Common questions for this step">
          {chips.map((q) => (
            <li key={q}>
              <button className="chip-btn" type="button" onClick={() => ask(q)} disabled={asking}>
                {q}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="inline-form"
        onSubmit={(event) => {
          event.preventDefault()
          ask(question.trim())
        }}
      >
        <div className="field">
          <label htmlFor={`${id}-question`} className="sr-only">
            Your question about step {stepIndex + 1}
          </label>
          <input
            id={`${id}-question`}
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={chips.length ? 'Or ask your own' : 'Ask about this step'}
            maxLength={500}
            disabled={!online}
            aria-describedby={`${id}-hint`}
          />
        </div>
        <button className="btn btn-secondary" type="submit" disabled={!online || asking || !question.trim()}>
          {asking ? 'Asking…' : 'Ask'}
        </button>
      </form>
      <p id={`${id}-hint`} className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
        {online ? 'Gemini answers for this recipe at these amounts.' : 'Questions need the internet. The steps still work offline.'}
      </p>
      {asking && <Working label="Getting an answer…" typical="a few seconds" />}
    </section>
  )
}
