import { useId, useState } from 'react'
import Working from './Working'
import { askStep } from '../lib/askStep'
import { ingredientLine, scaledStepString } from '../lib/cooking'

// "Ask about this step": Gemini answers for this recipe at the amounts
// shown. Answers stay with the step they were asked on.
export default function AskStep({ recipe, steps, ingredients, factor, system, servings, stepIndex, online }) {
  const [answers, setAnswers] = useState({}) // step index -> [{ question, answer, error }]
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const id = useId()
  const stepAnswers = answers[stepIndex] ?? []

  async function handleAsk(event) {
    event.preventDefault()
    const text = question.trim()
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
    if (result.ok) setQuestion('')
    setAsking(false)
  }

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
      <form onSubmit={handleAsk} className="field">
        <label htmlFor={`${id}-question`}>Your question</label>
        <input
          id={`${id}-question`}
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What does fold in mean?"
          maxLength={500}
          disabled={!online}
          aria-describedby={`${id}-hint`}
        />
        <p id={`${id}-hint`} className="hint" style={{ margin: 0 }}>
          {online ? 'Gemini answers for this recipe at these amounts.' : 'Questions need the internet. The steps still work offline.'}
        </p>
        <button className="btn btn-secondary" type="submit" disabled={!online || asking || !question.trim()} style={{ alignSelf: 'flex-start' }}>
          {asking ? 'Asking…' : 'Ask'}
        </button>
        {asking && <Working label="Getting an answer…" typical="a few seconds" />}
      </form>
    </section>
  )
}
