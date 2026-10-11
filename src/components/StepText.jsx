import { scaleStepText } from '../lib/cooking'

// A step's text with its amounts scaled to match the ingredient list.
// Changed amounts are bold, so it's clear they aren't the recipe's own.
export default function StepText({ text, ingredients, factor = 1, system = 'us' }) {
  return scaleStepText(text, ingredients, factor, system).map((part, index) =>
    part.scaled ? (
      <strong key={index} className="scaled-amount">
        {part.text}
      </strong>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  )
}
