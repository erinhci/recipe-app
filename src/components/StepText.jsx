import { emphasize, rangeDash, scaleStepText } from '../lib/cooking'

// A step's text with its amounts scaled to match the ingredient list.
// Actions, amounts, temperatures, and times are bold so the step can be
// scanned with a glance; scaled amounts are among them. Number ranges
// show with an en dash.
export default function StepText({ text, ingredients, factor = 1, system = 'us' }) {
  return scaleStepText(text, ingredients, factor, system).flatMap((part, index) =>
    part.scaled ? (
      <strong key={index} className="scaled-amount">
        {part.text}
      </strong>
    ) : (
      emphasize(part.text).map((piece, j) =>
        piece.strong ? <strong key={`${index}-${j}`}>{rangeDash(piece.text)}</strong> : <span key={`${index}-${j}`}>{rangeDash(piece.text)}</span>,
      )
    ),
  )
}
