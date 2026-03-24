import { useState, useEffect } from 'react'
import Dashboard from './Dashboard'
import MockExam from './MockExam'

// ── default milestones ────────────────────────────────────────────────────────
const DEFAULT_MILESTONES = [
  { id: 'defense',      label: 'Final Defense',      dateStr: '2026-04-20', color: '#8B3A3A', bg: '#F5E8E8' },
  { id: 'graduation',   label: 'Graduation',          dateStr: '2026-05-18', color: '#2C4A7C', bg: '#E8EDF5' },
  { id: 'registration', label: 'Board Registration',  dateStr: '2026-06-05', color: '#3D6B4F', bg: '#E8F0EB' },
  { id: 'exam',         label: 'CBLE Exam',            dateStr: '2026-09-03', color: '#8B6F47', bg: '#F0E9DE' },
]

export type MilestoneData = typeof DEFAULT_MILESTONES[number]

function loadMilestones(): MilestoneData[] {
  try { const s = localStorage.getItem('milestones'); return s ? JSON.parse(s) : DEFAULT_MILESTONES }
  catch { return DEFAULT_MILESTONES }
}
function saveMilestones(ms: MilestoneData[]) {
  try { localStorage.setItem('milestones', JSON.stringify(ms)) } catch {}
}

// ── subjects ──────────────────────────────────────────────────────────────────
export const SUBJECTS = [
  'Library Organization and Management',
  'Reference, Bibliography, and User Services',
  'Cataloging and Classification',
  'Indexing and Abstracting',
  'Collection Management (Selection and Acquisition)',
  'Information Technology',
]
export const SUBJECT_SHORT = ['LOM', 'RBU', 'CC', 'IA', 'CM', 'IT']

export function getSubjectForDate(date: Date): { subject: string; short: string; weekNum: number; idx: number } {
  if (date.getDay() === 0) return { subject: 'Rest day', short: 'Rest', weekNum: 0, idx: -1 }
  const ref = date <= new Date(2026, 3, 21) ? new Date(2026, 2, 23) : new Date(2026, 3, 22)
  const diffDays = Math.floor((date.getTime() - ref.getTime()) / 86400000)
  const weekNum = Math.floor(Math.max(diffDays, 0) / 7)
  const idx = weekNum % 6
  return { subject: SUBJECTS[idx], short: SUBJECT_SHORT[idx], weekNum: weekNum + 1, idx }
}

export function getDaysUntil(target: Date): number {
  const now = new Date(); now.setHours(0,0,0,0)
  const t = new Date(target); t.setHours(0,0,0,0)
  return Math.ceil((t.getTime() - now.getTime()) / 86400000)
}

function isCapstonePhase(date: Date) { return date <= new Date(2026, 3, 21) }
export function isRestDay(date: Date) { return date.getDay() === 0 }
function isCardioDay(date: Date) { return date.getDay() === 3 }
function isGymDay(date: Date) { return [1,2,4,5].includes(date.getDay()) }

// ── checklist builder ─────────────────────────────────────────────────────────
export type ChecklistItem = {
  id: string; label: string; note?: string; time?: string
  tag: 'study'|'mock'|'capstone'|'gym'|'cardio'|'leisure'|'rest'|'custom'
  custom?: boolean
}

export function buildChecklist(date: Date): ChecklistItem[] {
  if (isRestDay(date)) return [
    { id: 'rest-sleep',   label: 'Sleep in — no alarm', tag: 'rest' },
    { id: 'rest-leisure', label: 'Leisure, errands, or social time', tag: 'leisure' },
    { id: 'rest-journal', label: 'Journal or read for pleasure', tag: 'leisure' },
    { id: 'rest-prep',    label: 'Light prep for Monday (5–10 min)', note: "Set out materials, check this week's subject", tag: 'rest' },
  ]
  const capstone = isCapstonePhase(date)
  const cardio = isCardioDay(date)
  const gym = isGymDay(date)
  const { subject } = getSubjectForDate(date)
  const items: ChecklistItem[] = []
  if (cardio) {
    items.push(
      { id: 'wake',            label: 'Wake up & morning prep',               time: '5:30 AM',           tag: 'rest' },
      { id: 'review-light',   label: `Light review — ${subject}`,             time: '6:00 – 8:00 AM',    note: 'Reading and recall only, no heavy new material', tag: 'study' },
      { id: 'mock',            label: 'Mock exam — 100 items (timed)',         time: '8:00 – 9:30 AM',    note: 'Review every wrong answer immediately after', tag: 'mock' },
      { id: 'capstone-morning',label: capstone ? 'Capstone work session' : 'Study session', time: '9:30 AM – 12:00 PM', tag: capstone ? 'capstone' : 'study' },
      { id: 'lunch',           label: 'Lunch',                                 time: '12:00 – 1:00 PM',   tag: 'rest' },
      { id: 'cardio',          label: 'Cardio session',                        time: '1:00 – 3:00 PM',    note: 'Run, bike, or swim — outdoors if possible', tag: 'cardio' },
      { id: 'afternoon-light', label: 'Light afternoon study or rest',         time: '3:00 – 5:00 PM',    note: 'Flashcards, review podcast, or genuine rest', tag: 'study' },
      { id: 'dinner',          label: 'Dinner & decompress',                   time: '5:00 – 7:00 PM',    tag: 'rest' },
      { id: 'leisure',         label: 'Reading / journaling',                  time: '7:00 – 9:00 PM',    note: 'Leisure only — protect this block', tag: 'leisure' },
    )
  } else if (capstone) {
    items.push(
      { id: 'wake',       label: 'Wake up & morning prep',              time: '5:30 AM',           tag: 'rest' },
      { id: 'review',     label: `Board review — ${subject}`,           time: '6:00 – 7:30 AM',    note: "Light reading, theory recall, current week's subject", tag: 'study' },
      { id: 'mock',       label: 'Mock exam — 100 items (timed)',        time: '7:30 – 8:30 AM',    note: 'Daily non-negotiable. Review wrong answers.', tag: 'mock' },
      { id: 'breakfast',  label: 'Breakfast & short break',             time: '8:30 – 9:00 AM',    tag: 'rest' },
      { id: 'capstone-am',label: 'Capstone work — morning block',       time: '9:00 AM – 12:00 PM',note: 'System finalization this week → manuscript editing after', tag: 'capstone' },
      { id: 'lunch',      label: 'Lunch & rest',                        time: '12:00 – 1:00 PM',   tag: 'rest' },
      { id: 'capstone-pm',label: 'Capstone work — afternoon block',     time: '1:00 – 5:00 PM',    note: 'Deep work. Protect from distractions.', tag: 'capstone' },
      gym ? { id: 'gym',  label: 'Gym',                                 time: '5:00 – 7:00 PM',    tag: 'gym' }
          : { id: 'walk', label: 'Walk or light movement',              time: '5:00 – 6:00 PM',    tag: 'rest' },
      { id: 'dinner',     label: 'Dinner & decompress',                 time: '7:00 – 8:00 PM',    tag: 'rest' },
      { id: 'leisure',    label: 'Reading / journaling',                time: '8:00 – 9:30 PM',    note: 'Fiction, non-fiction, or personal journal', tag: 'leisure' },
      { id: 'winddown',   label: 'Wind down — lights out by 10',        time: '9:30 PM',            tag: 'rest' },
    )
  } else {
    items.push(
      { id: 'wake',       label: 'Wake up & morning prep',                          time: '5:30 AM',            tag: 'rest' },
      { id: 'review1',    label: `Deep review — ${subject}`,                        time: '6:00 – 8:30 AM',     note: 'Theory, notes, active recall, spaced repetition', tag: 'study' },
      { id: 'mock',       label: 'Mock exam — 100 items (timed)',                   time: '8:30 – 10:00 AM',    note: 'Full timed exam + thorough error review', tag: 'mock' },
      { id: 'break1',     label: 'Break & snack',                                   time: '10:00 – 10:30 AM',   tag: 'rest' },
      { id: 'review2',    label: 'Second review block',                             time: '10:30 AM – 12:30 PM',note: 'Revisit weak areas from mock exam', tag: 'study' },
      { id: 'lunch',      label: 'Lunch & optional nap',                            time: '12:30 – 1:30 PM',    tag: 'rest' },
      { id: 'review3',    label: 'Third review block',                              time: '1:30 – 4:00 PM',     note: 'Cross-subject recall, notes consolidation, flashcards', tag: 'study' },
      { id: 'break2',     label: 'Break & walk',                                    time: '4:00 – 4:30 PM',     tag: 'rest' },
      gym ? { id: 'gym',        label: 'Gym',           time: '4:30 – 6:30 PM', tag: 'gym' }
          : { id: 'review-eve', label: 'Evening review',time: '4:30 – 6:00 PM', tag: 'study' },
      { id: 'dinner',     label: 'Dinner & decompress',                             time: '6:30 – 7:30 PM',     tag: 'rest' },
      { id: 'leisure',    label: 'Reading / journaling',                            time: '7:30 – 9:00 PM',     note: 'Non-negotiable leisure. Burnout protection.', tag: 'leisure' },
      { id: 'winddown',   label: 'Light review or wind down — lights out by 10',    time: '9:00 – 10:00 PM',    note: 'Scan notes or do nothing. Both are fine.', tag: 'rest' },
    )
  }
  return items
}

export const TAG_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  study:    { label: 'Study',     color: '#2C4A7C', bg: '#E8EDF5' },
  mock:     { label: 'Mock exam', color: '#8B3A3A', bg: '#F5E8E8' },
  capstone: { label: 'Capstone',  color: '#8B6F47', bg: '#F0E9DE' },
  gym:      { label: 'Gym',       color: '#3D6B4F', bg: '#E8F0EB' },
  cardio:   { label: 'Cardio',    color: '#5A3D7C', bg: '#EDE8F5' },
  leisure:  { label: 'Leisure',   color: '#6B5A3A', bg: '#F5F0E8' },
  rest:     { label: 'Rest',      color: '#6B6558', bg: '#EFECE6' },
  custom:   { label: 'Custom',    color: '#4A6B5A', bg: '#E8F5EE' },
}

const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function formatDate(d: Date) {
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

function storageKey(d: Date)     { return `checks-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }
function customKey(d: Date)      { return `custom-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

// ── app ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [today]      = useState(() => new Date())
  const [viewDate, setViewDate] = useState(() => new Date())
  const [checks, setChecks]     = useState<Record<string,boolean>>({})
  const [activeTab, setActiveTab] = useState<'dashboard'|'exam'|'checklist'|'milestones'|'subjects'>('dashboard')
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('darkMode') === 'true' } catch { return false }
  })
  const [milestones, setMilestones] = useState<MilestoneData[]>(loadMilestones)
  const [editingMilestone, setEditingMilestone] = useState<string|null>(null)
  const [customTasks, setCustomTasks] = useState<ChecklistItem[]>([])
  const [newTaskLabel, setNewTaskLabel] = useState('')
  const [showAddTask, setShowAddTask] = useState(false)

  const dateKey = storageKey(viewDate)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    try { localStorage.setItem('darkMode', String(darkMode)) } catch {}
  }, [darkMode])

  useEffect(() => {
    try { const s = localStorage.getItem(dateKey); setChecks(s ? JSON.parse(s) : {}) }
    catch { setChecks({}) }
  }, [dateKey])

  useEffect(() => {
    try { const s = localStorage.getItem(customKey(viewDate)); setCustomTasks(s ? JSON.parse(s) : []) }
    catch { setCustomTasks([]) }
  }, [dateKey])

  function toggle(id: string) {
    setChecks(prev => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(dateKey, JSON.stringify(next)) } catch {}
      return next
    })
  }

  function addCustomTask() {
    const label = newTaskLabel.trim()
    if (!label) return
    const id = `custom-${Date.now()}`
    const task: ChecklistItem = { id, label, tag: 'custom', custom: true }
    const next = [...customTasks, task]
    setCustomTasks(next)
    try { localStorage.setItem(customKey(viewDate), JSON.stringify(next)) } catch {}
    setNewTaskLabel('')
    setShowAddTask(false)
  }

  function removeCustomTask(id: string) {
    const next = customTasks.filter(t => t.id !== id)
    setCustomTasks(next)
    try { localStorage.setItem(customKey(viewDate), JSON.stringify(next)) } catch {}
    setChecks(prev => { const n = { ...prev }; delete n[id]; try { localStorage.setItem(dateKey, JSON.stringify(n)) } catch {} return n })
  }

  function shiftDate(delta: number) {
    setViewDate(d => { const n = new Date(d); n.setDate(n.getDate() + delta); return n })
  }

  function updateMilestoneDate(id: string, dateStr: string) {
    if (!dateStr) return
    const next = milestones.map(m => m.id === id ? { ...m, dateStr } : m)
    setMilestones(next); saveMilestones(next); setEditingMilestone(null)
  }

  const isToday   = viewDate.toDateString() === today.toDateString()
  const builtItems = buildChecklist(viewDate)
  const allItems   = [...builtItems, ...customTasks]
  const checkedCount = allItems.filter(i => checks[i.id]).length
  const progress   = allItems.length > 0 ? checkedCount / allItems.length : 0
  const { subject, short } = getSubjectForDate(viewDate)
  const restDay   = isRestDay(viewDate)
  const capstone  = isCapstonePhase(viewDate)
  const examMs    = milestones.find(m => m.id === 'exam')!
  const examDate  = new Date(examMs.dateStr)

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--cream)', color: 'var(--ink)', transition: 'background 0.2s, color 0.2s' }}>

      {/* ── header ── */}
      <header style={{ padding: '14px 24px', borderBottom: '1px solid var(--cream-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', lineHeight: 1.2 }}>Jake's Boards</div>
          <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 2 }}>CBLE {examDate.getFullYear()} · topnotcher roadmap</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {capstone && !restDay && <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', background: '#F5E8E8', color: '#8B3A3A', borderRadius: 4 }}>Capstone</span>}
          {!capstone && !restDay && <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', background: 'var(--accent-bg)', color: 'var(--accent)', borderRadius: 4 }}>{short}</span>}
          {restDay && <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', background: 'var(--cream-dark)', color: 'var(--ink-muted)', borderRadius: 4 }}>Rest day</span>}
          <button onClick={() => setDarkMode(d => !d)} title="Toggle dark mode" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--cream-border)', background: 'var(--cream-dark)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-muted)' }}>
            {darkMode ? '☀' : '☽'}
          </button>
        </div>
      </header>

      {/* ── date nav ── */}
      {activeTab !== 'dashboard' && activeTab !== 'exam' && (
        <div style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--cream-border)' }}>
          <button onClick={() => shiftDate(-1)} style={navBtn}>←</button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink)' }}>{formatDate(viewDate)}</div>
            {!isToday
              ? <button onClick={() => setViewDate(new Date())} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 2, fontFamily: 'var(--font-body)' }}>Back to today</button>
              : <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 2 }}>Today</div>
            }
          </div>
          <button onClick={() => shiftDate(1)} style={navBtn}>→</button>
        </div>
      )}

      {/* ── tabs ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--cream-border)', padding: '0 24px', overflowX: 'auto' }}>
        {(['dashboard','exam','checklist','milestones','subjects'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            fontFamily: 'var(--font-body)', fontSize: 13, padding: '10px 14px',
            background: 'none', border: 'none', whiteSpace: 'nowrap',
            borderBottom: activeTab === tab ? '2px solid var(--ink)' : '2px solid transparent',
            color: activeTab === tab ? 'var(--ink)' : 'var(--ink-faint)',
            cursor: 'pointer', fontWeight: activeTab === tab ? 500 : 400, transition: 'color 0.15s',
            textTransform: tab === 'exam' ? 'none' : 'capitalize',
          }}>{tab === 'exam' ? 'Mock Exam' : tab}</button>
        ))}
      </div>

      {/* ── main ── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: (activeTab === 'dashboard' || activeTab === 'exam') ? 0 : '20px 24px' }}>

        {activeTab === 'dashboard' && <Dashboard milestones={milestones} />}
        {activeTab === 'exam'      && <MockExam />}

        {/* checklist */}
        {activeTab === 'checklist' && (
          <>
            {allItems.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-muted)' }}>{checkedCount} of {allItems.length} completed</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>{Math.round(progress * 100)}%</span>
                </div>
                <div style={{ height: 4, background: 'var(--cream-border)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress * 100}%`, background: progress === 1 ? 'var(--green)' : 'var(--accent)', borderRadius: 2, transition: 'width 0.3s ease' }} />
                </div>
              </div>
            )}

            {!restDay && (
              <div style={{ background: 'var(--cream-dark)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, borderLeft: '3px solid var(--accent-light)' }}>
                <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 2 }}>
                  {capstone ? 'Capstone phase — morning board subject' : "This week's subject"}
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{subject}</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {allItems.map(item => {
                const done = !!checks[item.id]
                const tag  = TAG_STYLES[item.custom ? 'custom' : item.tag] || TAG_STYLES.rest
                return (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div onClick={() => toggle(item.id)} style={{
                      flex: 1, display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '12px 14px', background: done ? 'var(--cream-dark)' : 'var(--cream)',
                      border: '1px solid var(--cream-border)', borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', transition: 'background 0.15s', opacity: done ? 0.65 : 1,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
                        border: `1.5px solid ${done ? 'var(--green)' : 'var(--cream-border)'}`,
                        background: done ? 'var(--green)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                      }}>
                        {done && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', textDecoration: done ? 'line-through' : 'none' }}>{item.label}</span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: tag.bg, color: tag.color, fontWeight: 500 }}>{tag.label}</span>
                        </div>
                        {item.time && <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 1 }}>{item.time}</div>}
                        {item.note && <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 3, fontStyle: 'italic' }}>{item.note}</div>}
                      </div>
                    </div>
                    {item.custom && (
                      <button onClick={() => removeCustomTask(item.id)} title="Remove" style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', flexShrink: 0, marginTop: 8, border: '1px solid var(--cream-border)', background: 'var(--cream-dark)', cursor: 'pointer', color: 'var(--ink-faint)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* add custom task */}
            <div style={{ marginTop: 16 }}>
              {showAddTask ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input autoFocus value={newTaskLabel} onChange={e => setNewTaskLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addCustomTask(); if (e.key === 'Escape') setShowAddTask(false) }}
                    placeholder="Task description..."
                    style={{ flex: 1, padding: '8px 12px', fontSize: 13, border: '1px solid var(--cream-border)', borderRadius: 'var(--radius-sm)', background: 'var(--cream-dark)', color: 'var(--ink)', fontFamily: 'var(--font-body)', outline: 'none' }}
                  />
                  <button onClick={addCustomTask} style={{ padding: '8px 14px', fontSize: 13, border: 'none', borderRadius: 'var(--radius-sm)', background: 'var(--accent)', color: 'white', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Add</button>
                  <button onClick={() => setShowAddTask(false)} style={{ padding: '8px 14px', fontSize: 13, border: '1px solid var(--cream-border)', borderRadius: 'var(--radius-sm)', background: 'var(--cream-dark)', color: 'var(--ink-muted)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Cancel</button>
                </div>
              ) : (
                <button onClick={() => setShowAddTask(true)} style={{ width: '100%', padding: '9px 0', fontSize: 13, border: '1px dashed var(--cream-border)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--ink-faint)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>+ Add custom task</button>
              )}
            </div>

            {progress === 1 && allItems.length > 0 && (
              <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--green-bg)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--green)' }}>Day complete.</div>
                <div style={{ fontSize: 12, color: 'var(--green)', marginTop: 2, opacity: 0.8 }}>One more day closer to topnotcher.</div>
              </div>
            )}
          </>
        )}

        {/* milestones */}
        {activeTab === 'milestones' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}>Tap a date to edit it. Changes reflect everywhere in the app.</div>
            {milestones.map(m => {
              const date = new Date(m.dateStr)
              const days = getDaysUntil(date)
              const editing = editingMilestone === m.id
              return (
                <div key={m.id} style={{ padding: '14px 16px', background: 'var(--cream)', border: '1px solid var(--cream-border)', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>{m.label}</div>
                    {editing ? (
                      <input type="date" defaultValue={m.dateStr} autoFocus
                        onBlur={e => updateMilestoneDate(m.id, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') updateMilestoneDate(m.id, (e.target as HTMLInputElement).value); if (e.key === 'Escape') setEditingMilestone(null) }}
                        style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--accent-light)', borderRadius: 'var(--radius-sm)', background: 'var(--cream-dark)', color: 'var(--ink)', fontFamily: 'var(--font-body)', outline: 'none' }}
                      />
                    ) : (
                      <div onClick={() => setEditingMilestone(m.id)} style={{ fontSize: 11, color: 'var(--ink-faint)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}
                        <span style={{ fontSize: 10, color: 'var(--accent)', opacity: 0.7 }}>edit</span>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, padding: '4px 12px', borderRadius: 'var(--radius-sm)', background: days < 0 ? 'var(--cream-dark)' : m.bg, color: days < 0 ? 'var(--ink-faint)' : m.color, flexShrink: 0 }}>
                    {days < 0 ? 'Done' : days === 0 ? 'Today' : `${days}d`}
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 8, padding: '14px 16px', background: 'var(--accent-bg)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--accent-light)' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginBottom: 4 }}>Days to CBLE exam</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: 'var(--accent)' }}>{getDaysUntil(examDate)}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginTop: 2 }}>
                {examDate.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })} · Aim for topnotcher.
              </div>
            </div>
            <button onClick={() => { saveMilestones(DEFAULT_MILESTONES); setMilestones(DEFAULT_MILESTONES) }} style={{ padding: '8px 0', fontSize: 12, border: '1px solid var(--cream-border)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--ink-faint)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
              Reset to defaults
            </button>
          </div>
        )}

        {/* subjects */}
        {activeTab === 'subjects' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 12, color: 'var(--ink-muted)', marginBottom: 4 }}>One subject per week · Mon–Sat · 6-week cycle, repeating continuously</div>
            {SUBJECTS.map((s, i) => {
              const isCurrent = !restDay && getSubjectForDate(viewDate).subject === s
              return (
                <div key={s} style={{ padding: '12px 14px', background: isCurrent ? 'var(--accent-bg)' : 'var(--cream)', border: `1px solid ${isCurrent ? 'var(--accent-light)' : 'var(--cream-border)'}`, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: isCurrent ? 'var(--accent)' : 'var(--cream-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, color: isCurrent ? 'white' : 'var(--ink-muted)' }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{s}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-faint)' }}>{SUBJECT_SHORT[i]}</div>
                  </div>
                  {isCurrent && <div style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', background: 'var(--accent)', color: 'white', borderRadius: 3, fontWeight: 500 }}>This week</div>}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--cream-border)', background: 'var(--cream)',
  cursor: 'pointer', fontSize: 14, color: 'var(--ink-muted)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--font-body)',
}
