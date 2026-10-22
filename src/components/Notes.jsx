import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { AvatarFace } from './Avatar'
import { addNote, deleteNote, toggleLike } from '../lib/data'
import { useRequired } from '../lib/useRequired'

const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

// "2 notes · 1 reply", for the Notes section's summary line.
export function notesSummary(notes) {
  const top = notes.filter((n) => !n.parent_id).length
  const replies = notes.length - top
  if (!notes.length) return null
  return [`${top} ${top === 1 ? 'note' : 'notes'}`, replies ? `${replies} ${replies === 1 ? 'reply' : 'replies'}` : null]
    .filter(Boolean)
    .join(' · ')
}

// Notes on a recipe as a thread. Each note can be liked by the other cook
// and answered with a reply (one level deep). Your own notes say who liked
// them instead of offering a Like button.
// people: from useKitchenPeople, for faces and colors.
export default function Notes({ recipe, notes, likes, member, people, nameFor, changesFromNote, online }) {
  const [text, setText] = useState('')
  const required = useRequired('note', 'Write a note first.')
  const [replyTo, setReplyTo] = useState(null) // note id
  const top = notes.filter((n) => !n.parent_id || !notes.some((p) => p.id === n.parent_id))
  const repliesTo = (id) => notes.filter((n) => n.parent_id === id)

  async function post(event) {
    event.preventDefault()
    if (!required.check(text)) return
    await addNote(recipe.id, text, member)
    setText('')
  }

  return (
    <>
      {top.length === 0 ? (
        <p className="hint">No notes yet.</p>
      ) : (
        <ul className="comments">
          {top.map((note) => (
            <Note
              key={note.id}
              note={note}
              replies={repliesTo(note.id)}
              likes={likes}
              member={member}
              people={people}
              nameFor={nameFor}
              used={changesFromNote.get(note.id)}
              usedBy={(version) => nameFor(version.created_by)}
              online={online}
              recipe={recipe}
              replying={replyTo === note.id}
              onReply={() => setReplyTo(replyTo === note.id ? null : note.id)}
              onReplyDone={() => setReplyTo(null)}
            />
          ))}
        </ul>
      )}
      {!online && notes.length > 0 && <p className="hint">Turning a note into a recipe change needs the internet.</p>}
      <form onSubmit={post} className="comment-form">
        <label htmlFor="note" className="sr-only">
          Add a note
        </label>
        <textarea
          ref={required.ref}
          id="note"
          rows={2}
          placeholder="Add a note…"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            required.clear()
          }}
          {...required.field()}
        />
        <button className="btn" type="submit">
          Post
        </button>
      </form>
      {required.error}
    </>
  )
}

function Face({ userId, people, name }) {
  const cook = people?.byUser?.[userId]
  if (cook) return <AvatarFace look={cook.look} color={cook.color} size={32} className="comment-face" />
  return (
    <span className="avatar" aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

// Who liked a note, in words: "Brian liked this".
function likedBy(noteLikes, nameFor, member) {
  const names = noteLikes.map((l) => (l.member_id === member.user_id ? 'You' : nameFor(l.member_id)))
  return names.length ? `${names.join(' and ')} liked this` : ''
}

function Note({ note, replies = [], likes, member, people, nameFor, used, usedBy, online, recipe, replying, onReply, onReplyDone, isReply = false }) {
  const navigate = useNavigate()
  const mine = note.author_id === member.user_id
  const name = nameFor(note.author_id)
  const noteLikes = likes.filter((l) => l.note_id === note.id)
  const iLiked = noteLikes.some((l) => l.member_id === member.user_id)
  const owner = mine ? 'your' : `${name}'s`
  // Notes the app used to post after a change ("Changed the recipe from
  // ..."). They describe a change already made, so they get no "Turn into
  // a recipe change".
  const appNote = /^Changed the recipe from .+'s note:/.test(note.body)

  const deleteButton = mine && (
    <button
      className="link-btn"
      type="button"
      onClick={async () => {
        const extra = replies.length ? ` Its ${replies.length === 1 ? 'reply goes' : `${replies.length} replies go`} too.` : ''
        if (window.confirm(`Delete this ${isReply ? 'reply' : 'note'}?${extra}`)) await deleteNote(note.id)
      }}
    >
      Delete<span className="sr-only"> {isReply ? 'this reply' : 'this note'}</span>
    </button>
  )

  if (appNote) {
    return (
      <li className="comment comment-app">
        <p className="hint" style={{ margin: 0 }}>
          {note.body.replace(/^Changed the recipe from .+?'s note: /, 'Recipe updated: ')} · {shortDate.format(new Date(note.created_at))}
        </p>
        {deleteButton && <div className="comment-actions">{deleteButton}</div>}
      </li>
    )
  }

  return (
    <li className={isReply ? 'comment is-reply' : 'comment'}>
      <Face userId={note.author_id} people={people} name={name} />
      <div className="comment-body">
        <p className="comment-meta">
          <strong>{name}</strong> <span className="hint">· {shortDate.format(new Date(note.created_at))}</span>
          {note.cooked_on && <span className="hint"> · changed while cooking</span>}
        </p>
        <p style={{ margin: 0 }}>{note.body}</p>
        {used && (
          <p className="hint" style={{ margin: 'var(--space-1) 0 0' }}>
            ✓ Used to change the recipe{used.summary ? `: ${used.summary}` : ''} ({usedBy(used.version)},{' '}
            {shortDate.format(new Date(used.version.created_at))})
          </p>
        )}
        <div className="comment-actions">
          {mine ? (
            noteLikes.length > 0 && (
              <p className="liked-by">
                <Icon name="heart" size={18} filled />
                {likedBy(noteLikes, nameFor, member)}
              </p>
            )
          ) : (
            <button
              className="icon-text-btn"
              type="button"
              aria-pressed={iLiked}
              aria-label={`Like ${owner} ${isReply ? 'reply' : 'note'}`}
              onClick={() => toggleLike(note.id, member)}
            >
              <Icon name="heart" size={20} filled={iLiked} />
              {iLiked ? 'Liked' : 'Like'}
            </button>
          )}
          {!isReply && (
            <button className="icon-text-btn" type="button" aria-expanded={replying} aria-label={`Reply to ${owner} note`} onClick={onReply}>
              <Icon name="reply" size={20} />
              Reply
            </button>
          )}
          {!isReply && !used && (
            <button className="link-btn" type="button" disabled={!online} onClick={() => navigate(`/recipe/${recipe.id}/note/${note.id}`)}>
              Turn into a recipe change
            </button>
          )}
          {deleteButton}
        </div>
        {(replies.length > 0 || replying) && (
          <ul className="replies" aria-label={`Replies to ${owner} note`}>
            {replies.map((reply) => (
              <Note
                key={reply.id}
                note={reply}
                likes={likes}
                member={member}
                people={people}
                nameFor={nameFor}
                online={online}
                recipe={recipe}
                isReply
              />
            ))}
            {replying && <ReplyForm recipe={recipe} parent={note} member={member} owner={owner} onDone={onReplyDone} />}
          </ul>
        )}
      </div>
    </li>
  )
}

function ReplyForm({ recipe, parent, member, owner, onDone }) {
  const [text, setText] = useState('')
  const id = `reply-${parent.id}`
  const required = useRequired(id, 'Write a reply first.')
  const { ref } = required
  useEffect(() => {
    ref.current?.focus()
  }, [ref])
  async function post(event) {
    event.preventDefault()
    if (!required.check(text)) return
    await addNote(recipe.id, text, member, null, parent.id)
    onDone()
  }
  return (
    <li className="reply-form">
      <form onSubmit={post} className="comment-form">
        <label htmlFor={id} className="sr-only">
          Reply to {owner} note
        </label>
        <textarea
          ref={ref}
          id={id}
          rows={2}
          placeholder="Write a reply…"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            required.clear()
          }}
          onKeyDown={(e) => e.key === 'Escape' && onDone()}
          {...required.field()}
        />
        <button className="btn" type="submit">
          Reply
        </button>
      </form>
      {required.error}
    </li>
  )
}
