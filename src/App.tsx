import { useState, useEffect } from "react";
import Dashboard from "./Dashboard";
import MockExam from "./MockExam";
import Onboarding from "./Onboarding";
import TourOverlay from "./TourOverlay";
import Pomodoro from "./Pomodoro";

// ── storage state helpers
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// ── default milestones
const DEFAULT_MILESTONES = [
  {
    id: "registration",
    label: "Board Registration",
    dateStr: "2026-06-05",
    color: "var(--green)",
    bg: "var(--green-bg)",
  },
  {
    id: "exam",
    label: "CBLEL Exam",
    dateStr: "2026-09-03",
    color: "var(--accent)",
    bg: "var(--accent-bg)",
  },
];

export type MilestoneData = (typeof DEFAULT_MILESTONES)[number];

function loadMilestones(): MilestoneData[] {
  return loadJSON("milestones", DEFAULT_MILESTONES);
}
function saveMilestones(ms: MilestoneData[]) {
  saveJSON("milestones", ms);
}

// ── subjects
export const DEFAULT_SUBJECTS = [
  { name: "Library Organization and Management", short: "LOM", weight: 20 },
  {
    name: "Reference, Bibliography, and User Services",
    short: "RBU",
    weight: 20,
  },
  { name: "Cataloging and Classification", short: "CC", weight: 20 },
  { name: "Indexing and Abstracting", short: "IA", weight: 15 },
  {
    name: "Collection Management (Selection and Acquisition)",
    short: "CM",
    weight: 15,
  },
  { name: "Information Technology", short: "IT", weight: 10 },
];

export function loadSubjects() {
  // Gracefully merge missing weights for existing users
  const loaded: typeof DEFAULT_SUBJECTS = loadJSON(
    "subjects",
    DEFAULT_SUBJECTS,
  );
  return loaded.map((s) => {
    if (s.weight) return s;
    const defaultSub = DEFAULT_SUBJECTS.find((ds) => ds.short === s.short);
    return { ...s, weight: defaultSub ? defaultSub.weight : 0 };
  });
}

export function isRestDay(
  date: Date,
  studyDays: number[] = [1, 2, 3, 4, 5, 6],
) {
  return !studyDays.includes(date.getDay());
}

export function getSubjectForDate(
  date: Date,
  startDateStr: string,
  subjects: typeof DEFAULT_SUBJECTS,
  cycleLength: number = 6,
  studyDays: number[] = [1, 2, 3, 4, 5, 6],
): {
  subject: string;
  short: string;
  weekNum: number;
  idx: number;
  weight?: number;
} {
  if (isRestDay(date, studyDays))
    return { subject: "Rest day", short: "Rest", weekNum: 0, idx: -1 };

  const ref = new Date(startDateStr);
  ref.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  // Count how many valid study days have passed since the start date
  let validDaysPassed = 0;
  const d = new Date(ref);
  while (d < target) {
    if (!isRestDay(d, studyDays)) {
      validDaysPassed++;
    }
    d.setDate(d.getDate() + 1);
  }

  const cycleNum = Math.floor(Math.max(validDaysPassed, 0) / cycleLength);
  const idx = cycleNum % subjects.length;
  const s = subjects[idx];
  return {
    subject: s.name,
    short: s.short,
    weekNum: cycleNum + 1,
    idx,
    weight: s.weight,
  };
}

export function getDaysUntil(target: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  return Math.ceil((t.getTime() - now.getTime()) / 86400000);
}

// ── checklist builder
export type ChecklistItem = {
  id: string;
  label: string;
  note?: string;
  time?: string;
  tag: "study" | "mock" | "leisure" | "rest" | "custom";
  custom?: boolean;
};

export const DEFAULT_REST_TEMPLATE: ChecklistItem[] = [
  { id: "rest-sleep", label: "Sleep in — no alarm", tag: "rest" },
  {
    id: "rest-leisure",
    label: "Leisure, errands, or social time",
    tag: "leisure",
  },
  {
    id: "rest-journal",
    label: "Journal or read for pleasure",
    tag: "leisure",
  },
  {
    id: "rest-prep",
    label: "Light prep for tomorrow (5–10 min)",
    note: "Set out materials, check tomorrow's subject",
    tag: "rest",
  },
];

export const DEFAULT_STUDY_TEMPLATE: ChecklistItem[] = [
  {
    id: "wake",
    label: "Wake up & morning prep",
    time: "5:30 AM",
    tag: "rest",
  },
  {
    id: "review1",
    label: "Deep review", // will be dynamically updated
    time: "6:00 – 8:30 AM",
    note: "Theory, notes, active recall, spaced repetition",
    tag: "study",
  },
  {
    id: "mock",
    label: "Mock exam — 100 items (timed)",
    time: "8:30 – 10:00 AM",
    note: "Full timed exam + thorough error review",
    tag: "mock",
  },
  {
    id: "break1",
    label: "Break & snack",
    time: "10:00 – 10:30 AM",
    tag: "rest",
  },
  {
    id: "review2",
    label: "Second review block",
    time: "10:30 AM – 12:30 PM",
    note: "Revisit weak areas from mock exam",
    tag: "study",
  },
  {
    id: "lunch",
    label: "Lunch & optional nap",
    time: "12:30 – 1:30 PM",
    tag: "rest",
  },
  {
    id: "review3",
    label: "Third review block",
    time: "1:30 – 4:00 PM",
    note: "Cross-subject recall, notes consolidation, flashcards",
    tag: "study",
  },
  {
    id: "break2",
    label: "Break & walk",
    time: "4:00 – 4:30 PM",
    tag: "rest",
  },
  {
    id: "review-eve",
    label: "Evening review",
    time: "4:30 – 6:00 PM",
    tag: "study",
  },
  {
    id: "dinner",
    label: "Dinner & decompress",
    time: "6:30 – 7:30 PM",
    tag: "rest",
  },
  {
    id: "leisure",
    label: "Reading / journaling",
    time: "7:30 – 9:00 PM",
    note: "Non-negotiable leisure. Burnout protection.",
    tag: "leisure",
  },
  {
    id: "winddown",
    label: "Light review or wind down — lights out by 10",
    time: "9:00 – 10:00 PM",
    note: "Scan notes or do nothing. Both are fine.",
    tag: "rest",
  },
];

export function buildChecklist(
  date: Date,
  startDateStr: string,
  subjects: typeof DEFAULT_SUBJECTS,
  cycleLength: number = 6,
  studyDays: number[] = [1, 2, 3, 4, 5, 6],
  studyTemplate: ChecklistItem[] = DEFAULT_STUDY_TEMPLATE,
  restTemplate: ChecklistItem[] = DEFAULT_REST_TEMPLATE,
): ChecklistItem[] {
  if (isRestDay(date, studyDays)) {
    return restTemplate;
  }
  const { subject } = getSubjectForDate(
    date,
    startDateStr,
    subjects,
    cycleLength,
    studyDays,
  );

  return studyTemplate.map((item) => {
    if (item.id === "review1") {
      return { ...item, label: `Deep review — ${subject}` };
    }
    return item;
  });
}

export const TAG_STYLES: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  study: { label: "Study", color: "var(--blue)", bg: "var(--blue-bg)" },
  mock: { label: "Mock exam", color: "var(--red)", bg: "var(--red-bg)" },
  leisure: { label: "Leisure", color: "var(--accent)", bg: "var(--accent-bg)" },
  rest: { label: "Rest", color: "var(--ink-muted)", bg: "var(--cream-dark)" },
  custom: { label: "Custom", color: "var(--green)", bg: "var(--green-bg)" },
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function formatDate(d: Date) {
  return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function storageKey(d: Date) {
  return `checks-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function customKey(d: Date) {
  return `custom-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function deletedKey(d: Date) {
  return `deleted-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ── app
export default function App() {
  // Config state
  const [userName, setUserName] = useState<string | null>(() =>
    loadJSON("userName", null),
  );
  const [startDateStr, setStartDateStr] = useState<string | null>(() =>
    loadJSON("startDateStr", null),
  );
  const [subjects, setSubjects] =
    useState<typeof DEFAULT_SUBJECTS>(loadSubjects);
  const [cycleLength, setCycleLength] = useState<number>(() =>
    loadJSON("cycleLength", 6),
  );
  const [studyDays, setStudyDays] = useState<number[]>(() =>
    loadJSON("studyDays", [1, 2, 3, 4, 5, 6]),
  );

  const [today] = useState(() => new Date());
  const [viewDate, setViewDate] = useState(() => new Date());
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "exam" | "checklist" | "milestones" | "subjects"
  >("dashboard");
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("darkMode") === "true";
    } catch {
      return false;
    }
  });
  const [milestones, setMilestones] = useState<MilestoneData[]>(loadMilestones);
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null);
  const [customTasks, setCustomTasks] = useState<ChecklistItem[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<string[]>([]);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskNote, setNewTaskNote] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [tourSeen, setTourSeen] = useState(() => loadJSON("tourSeen", false));

  const [studyTemplate, setStudyTemplate] = useState<ChecklistItem[]>(() =>
    loadJSON("studyTemplate", DEFAULT_STUDY_TEMPLATE),
  );
  const [restTemplate, setRestTemplate] = useState<ChecklistItem[]>(() =>
    loadJSON("restTemplate", DEFAULT_REST_TEMPLATE),
  );
  const [editingTemplate, setEditingTemplate] = useState<
    "study" | "rest" | null
  >(null);
  const [templateEditMode, setTemplateEditMode] = useState<"view" | "edit">(
    "view",
  );

  const dateKey = storageKey(viewDate);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      darkMode ? "dark" : "light",
    );
    try {
      localStorage.setItem("darkMode", String(darkMode));
    } catch {}
  }, [darkMode]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(dateKey);
      setChecks(s ? JSON.parse(s) : {});
    } catch {
      setChecks({});
    }
  }, [dateKey]);

  useEffect(() => {
    try {
      const s = localStorage.getItem(customKey(viewDate));
      setCustomTasks(s ? JSON.parse(s) : []);
    } catch {
      setCustomTasks([]);
    }
    try {
      const s = localStorage.getItem(deletedKey(viewDate));
      setDeletedTasks(s ? JSON.parse(s) : []);
    } catch {
      setDeletedTasks([]);
    }
  }, [dateKey, viewDate]);

  function toggle(id: string) {
    setChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(dateKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function addCustomTask() {
    const label = newTaskLabel.trim();
    if (!label) return;
    const time = newTaskTime.trim();
    const note = newTaskNote.trim();
    const id = `custom-${Date.now()}`;
    const task: ChecklistItem = {
      id,
      label,
      time: time || undefined,
      note: note || undefined,
      tag: "custom",
      custom: true,
    };
    const next = [...customTasks, task];
    setCustomTasks(next);
    try {
      localStorage.setItem(customKey(viewDate), JSON.stringify(next));
    } catch {}
    setNewTaskLabel("");
    setNewTaskTime("");
    setNewTaskNote("");
    setShowAddTask(false);
  }

  function removeCustomTask(id: string) {
    const next = customTasks.filter((t) => t.id !== id);
    setCustomTasks(next);
    try {
      localStorage.setItem(customKey(viewDate), JSON.stringify(next));
    } catch {}
    setChecks((prev) => {
      const n = { ...prev };
      delete n[id];
      try {
        localStorage.setItem(dateKey, JSON.stringify(n));
      } catch {}
      return n;
    });
  }

  function removePrescribedTask(id: string) {
    const next = [...deletedTasks, id];
    setDeletedTasks(next);
    try {
      localStorage.setItem(deletedKey(viewDate), JSON.stringify(next));
    } catch {}
    setChecks((prev) => {
      const n = { ...prev };
      delete n[id];
      try {
        localStorage.setItem(dateKey, JSON.stringify(n));
      } catch {}
      return n;
    });
  }

  function restorePrescribedTasks() {
    setDeletedTasks([]);
    try {
      localStorage.removeItem(deletedKey(viewDate));
    } catch {}
  }

  function shiftDate(delta: number) {
    setViewDate((d) => {
      const n = new Date(d);
      n.setDate(n.getDate() + delta);
      return n;
    });
  }

  function updateMilestoneDate(id: string, dateStr: string) {
    if (!dateStr) return;
    const next = milestones.map((m) => (m.id === id ? { ...m, dateStr } : m));
    setMilestones(next);
    saveMilestones(next);
    setEditingMilestone(null);
  }

  if (!userName || !startDateStr) {
    return (
      <Onboarding
        onComplete={(name, newSubjects, newCycleLength, newStudyDays) => {
          setUserName(name);
          setSubjects(newSubjects);
          setCycleLength(newCycleLength);
          setStudyDays(newStudyDays);
          const d = new Date();
          const startStr = d.toISOString();
          setStartDateStr(startStr);
          saveJSON("userName", name);
          saveJSON("subjects", newSubjects);
          saveJSON("cycleLength", newCycleLength);
          saveJSON("studyDays", newStudyDays);
          saveJSON("startDateStr", startStr);
        }}
      />
    );
  }

  const isToday = viewDate.toDateString() === today.toDateString();
  const builtItems = buildChecklist(
    viewDate,
    startDateStr,
    subjects,
    cycleLength,
    studyDays,
    studyTemplate,
    restTemplate,
  );
  const allItems = [
    ...builtItems.filter((i) => !deletedTasks.includes(i.id)),
    ...customTasks,
  ];
  const checkedCount = allItems.filter((i) => checks[i.id]).length;
  const progress = allItems.length > 0 ? checkedCount / allItems.length : 0;
  const { subject, short } = getSubjectForDate(
    viewDate,
    startDateStr,
    subjects,
    cycleLength,
    studyDays,
  );
  const restDay = isRestDay(viewDate, studyDays);
  const examMs = milestones.find((m) => m.id === "exam")!;
  const examDate = new Date(examMs.dateStr);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--cream)",
        color: "var(--ink)",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      {!tourSeen && (
        <TourOverlay
          onDismiss={() => {
            setTourSeen(true);
            saveJSON("tourSeen", true);
          }}
        />
      )}

      {/* ── header ── */}
      <header
        style={{
          padding: "14px 24px",
          borderBottom: "1px solid var(--cream-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              color: "var(--ink)",
              lineHeight: 1.2,
            }}
          >
            {userName}'s Boards
          </div>
          <div
            style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 2 }}
          >
            CBLEL {examDate.getFullYear()} · The Licensed Librarian Roadmap
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!restDay && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                background: "var(--accent-bg)",
                color: "var(--accent)",
                borderRadius: 4,
              }}
            >
              {short}
            </span>
          )}
          {restDay && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 500,
                padding: "2px 8px",
                background: "var(--cream-dark)",
                color: "var(--ink-muted)",
                borderRadius: 4,
              }}
            >
              Rest day
            </span>
          )}
          <button
            onClick={() => setDarkMode((d) => !d)}
            title="Toggle dark mode"
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--cream-border)",
              background: "var(--cream-dark)",
              cursor: "pointer",
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-muted)",
            }}
          >
            {darkMode ? "☀" : "☽"}
          </button>
        </div>
      </header>

      {/* ── date nav ── */}
      {activeTab !== "dashboard" && activeTab !== "exam" && (
        <div
          style={{
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--cream-border)",
          }}
        >
          <button onClick={() => shiftDate(-1)} style={navBtn}>
            ←
          </button>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 16,
                color: "var(--ink)",
              }}
            >
              {formatDate(viewDate)}
            </div>
            {!isToday ? (
              <button
                onClick={() => setViewDate(new Date())}
                style={{
                  fontSize: 11,
                  color: "var(--accent)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  marginTop: 2,
                  fontFamily: "var(--font-body)",
                }}
              >
                Back to today
              </button>
            ) : (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  marginTop: 2,
                }}
              >
                Today
              </div>
            )}
          </div>
          <button onClick={() => shiftDate(1)} style={navBtn}>
            →
          </button>
        </div>
      )}

      {/* ── tabs ── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--cream-border)",
          padding: "0 24px",
          overflowX: "auto",
        }}
      >
        {(
          ["dashboard", "exam", "checklist", "milestones", "subjects"] as const
        ).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              padding: "10px 14px",
              background: "none",
              border: "none",
              whiteSpace: "nowrap",
              borderBottom:
                activeTab === tab
                  ? "2px solid var(--ink)"
                  : "2px solid transparent",
              color: activeTab === tab ? "var(--ink)" : "var(--ink-faint)",
              cursor: "pointer",
              fontWeight: activeTab === tab ? 500 : 400,
              transition: "color 0.15s",
              textTransform: tab === "exam" ? "none" : "capitalize",
            }}
          >
            {tab === "exam" ? "Mock Exam" : tab}
          </button>
        ))}
      </div>

      {/* ── main ── */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding:
            activeTab === "dashboard" || activeTab === "exam" ? 0 : "20px 24px",
        }}
      >
        {activeTab === "dashboard" && (
          <Dashboard
            userName={userName}
            startDateStr={startDateStr}
            subjects={subjects}
            milestones={milestones}
            cycleLength={cycleLength}
            studyDays={studyDays}
          />
        )}
        {activeTab === "exam" && <MockExam />}

        {/* checklist */}
        {activeTab === "checklist" && (
          <>
            {templateEditMode === "edit" ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 18,
                      color: "var(--ink)",
                    }}
                  >
                    Edit Prescription Template
                  </div>
                  <button
                    onClick={() => setTemplateEditMode("view")}
                    style={{ ...navBtn, padding: "6px 12px", fontSize: 12 }}
                  >
                    Done
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <button
                    onClick={() => setEditingTemplate("study")}
                    style={{
                      flex: 1,
                      padding: "8px",
                      fontSize: 13,
                      border: "1px solid var(--cream-border)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                      background:
                        editingTemplate === "study"
                          ? "var(--accent)"
                          : "var(--cream-dark)",
                      color:
                        editingTemplate === "study"
                          ? "white"
                          : "var(--ink-muted)",
                    }}
                  >
                    Study Days
                  </button>
                  <button
                    onClick={() => setEditingTemplate("rest")}
                    style={{
                      flex: 1,
                      padding: "8px",
                      fontSize: 13,
                      border: "1px solid var(--cream-border)",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                      background:
                        editingTemplate === "rest"
                          ? "var(--accent)"
                          : "var(--cream-dark)",
                      color:
                        editingTemplate === "rest"
                          ? "white"
                          : "var(--ink-muted)",
                    }}
                  >
                    Rest Days
                  </button>
                </div>

                {editingTemplate && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    {(editingTemplate === "study"
                      ? studyTemplate
                      : restTemplate
                    ).map((item, idx) => (
                      <div
                        key={item.id}
                        style={{
                          background: "var(--cream-dark)",
                          padding: 12,
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--cream-border)",
                        }}
                      >
                        <input
                          value={item.label}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (editingTemplate === "study") {
                              const next = [...studyTemplate];
                              next[idx].label = val;
                              setStudyTemplate(next);
                              saveJSON("studyTemplate", next);
                            } else {
                              const next = [...restTemplate];
                              next[idx].label = val;
                              setRestTemplate(next);
                              saveJSON("restTemplate", next);
                            }
                          }}
                          placeholder="Task label"
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            marginBottom: 6,
                            fontSize: 13,
                            border: "1px solid var(--cream-border)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--cream)",
                            color: "var(--ink)",
                          }}
                        />
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            value={item.time || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (editingTemplate === "study") {
                                const next = [...studyTemplate];
                                next[idx].time = val || undefined;
                                setStudyTemplate(next);
                                saveJSON("studyTemplate", next);
                              } else {
                                const next = [...restTemplate];
                                next[idx].time = val || undefined;
                                setRestTemplate(next);
                                saveJSON("restTemplate", next);
                              }
                            }}
                            placeholder="Time"
                            style={{
                              flex: 1,
                              padding: "6px 10px",
                              fontSize: 12,
                              border: "1px solid var(--cream-border)",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--cream)",
                              color: "var(--ink)",
                            }}
                          />
                          <input
                            value={item.note || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (editingTemplate === "study") {
                                const next = [...studyTemplate];
                                next[idx].note = val || undefined;
                                setStudyTemplate(next);
                                saveJSON("studyTemplate", next);
                              } else {
                                const next = [...restTemplate];
                                next[idx].note = val || undefined;
                                setRestTemplate(next);
                                saveJSON("restTemplate", next);
                              }
                            }}
                            placeholder="Subtitle/Note"
                            style={{
                              flex: 2,
                              padding: "6px 10px",
                              fontSize: 12,
                              border: "1px solid var(--cream-border)",
                              borderRadius: "var(--radius-sm)",
                              background: "var(--cream)",
                              color: "var(--ink)",
                            }}
                          />
                        </div>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            marginTop: 8,
                          }}
                        >
                          <button
                            onClick={() => {
                              if (editingTemplate === "study") {
                                const next = studyTemplate.filter(
                                  (_, i) => i !== idx,
                                );
                                setStudyTemplate(next);
                                saveJSON("studyTemplate", next);
                              } else {
                                const next = restTemplate.filter(
                                  (_, i) => i !== idx,
                                );
                                setRestTemplate(next);
                                saveJSON("restTemplate", next);
                              }
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--red)",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newTask: ChecklistItem = {
                          id: `template-${Date.now()}`,
                          label: "New Task",
                          tag: "study",
                        };
                        if (editingTemplate === "study") {
                          const next = [...studyTemplate, newTask];
                          setStudyTemplate(next);
                          saveJSON("studyTemplate", next);
                        } else {
                          const next = [
                            ...restTemplate,
                            { ...newTask, tag: "rest" as const },
                          ];
                          setRestTemplate(next);
                          saveJSON("restTemplate", next);
                        }
                      }}
                      style={{
                        padding: "8px",
                        fontSize: 13,
                        border: "1px dashed var(--cream-border)",
                        borderRadius: "var(--radius-sm)",
                        background: "transparent",
                        color: "var(--ink-faint)",
                        cursor: "pointer",
                      }}
                    >
                      + Add task to template
                    </button>

                    <button
                      onClick={() => {
                        if (editingTemplate === "study") {
                          setStudyTemplate(DEFAULT_STUDY_TEMPLATE);
                          saveJSON("studyTemplate", DEFAULT_STUDY_TEMPLATE);
                        } else {
                          setRestTemplate(DEFAULT_REST_TEMPLATE);
                          saveJSON("restTemplate", DEFAULT_REST_TEMPLATE);
                        }
                      }}
                      style={{
                        marginTop: 24,
                        padding: "8px",
                        fontSize: 12,
                        border: "1px solid var(--cream-border)",
                        borderRadius: "var(--radius-sm)",
                        background: "transparent",
                        color: "var(--ink-faint)",
                        cursor: "pointer",
                      }}
                    >
                      Reset to Default Template
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {allItems.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        marginBottom: 6,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                        {checkedCount} of {allItems.length} completed
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--ink)",
                        }}
                      >
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: 4,
                        background: "var(--cream-border)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${progress * 100}%`,
                          background:
                            progress === 1 ? "var(--green)" : "var(--accent)",
                          borderRadius: 2,
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                )}

                {!restDay && (
                  <div
                    style={{
                      background: "var(--cream-dark)",
                      borderRadius: "var(--radius)",
                      padding: "12px 16px",
                      marginBottom: 16,
                      borderLeft: "3px solid var(--accent-light)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--ink-faint)",
                        marginBottom: 2,
                      }}
                    >
                      {"This week's subject"}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      {subject}
                    </div>
                  </div>
                )}

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {allItems.map((item) => {
                    const done = !!checks[item.id];
                    const tag =
                      TAG_STYLES[item.custom ? "custom" : item.tag] ||
                      TAG_STYLES.rest;
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                        }}
                      >
                        <div
                          onClick={() => toggle(item.id)}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 12,
                            padding: "12px 14px",
                            background: done
                              ? "var(--cream-dark)"
                              : "var(--cream)",
                            border: "1px solid var(--cream-border)",
                            borderRadius: "var(--radius-sm)",
                            cursor: "pointer",
                            transition: "background 0.15s",
                            opacity: done ? 0.65 : 1,
                          }}
                        >
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 4,
                              flexShrink: 0,
                              marginTop: 1,
                              border: `1.5px solid ${done ? "var(--green)" : "var(--cream-border)"}`,
                              background: done ? "var(--green)" : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "all 0.15s",
                            }}
                          >
                            {done && (
                              <svg
                                width="10"
                                height="8"
                                viewBox="0 0 10 8"
                                fill="none"
                              >
                                <path
                                  d="M1 4L3.5 6.5L9 1"
                                  stroke="white"
                                  strokeWidth="1.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                flexWrap: "wrap",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 500,
                                  color: "var(--ink)",
                                  textDecoration: done
                                    ? "line-through"
                                    : "none",
                                }}
                              >
                                {item.label}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 3,
                                  background: tag.bg,
                                  color: tag.color,
                                  fontWeight: 500,
                                }}
                              >
                                {tag.label}
                              </span>
                            </div>
                            {item.time && (
                              <div
                                style={{
                                  fontSize: 11,
                                  color: "var(--ink-faint)",
                                  marginTop: 1,
                                }}
                              >
                                {item.time}
                              </div>
                            )}
                            {item.note && (
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "var(--ink-muted)",
                                  marginTop: 3,
                                  fontStyle: "italic",
                                }}
                              >
                                {item.note}
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            item.custom
                              ? removeCustomTask(item.id)
                              : removePrescribedTask(item.id)
                          }
                          title="Remove"
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: "var(--radius-sm)",
                            flexShrink: 0,
                            marginTop: 8,
                            border: "1px solid var(--cream-border)",
                            background: "var(--cream-dark)",
                            cursor: "pointer",
                            color: "var(--ink-faint)",
                            fontSize: 16,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* restore tasks button */}
                {deletedTasks.length > 0 && (
                  <div style={{ marginTop: 12, textAlign: "right" }}>
                    <button
                      onClick={restorePrescribedTasks}
                      style={{
                        fontSize: 12,
                        color: "var(--ink-muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      Restore {deletedTasks.length} removed task
                      {deletedTasks.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                )}

                {/* add custom task */}
                <div style={{ marginTop: 16 }}>
                  {showAddTask ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        background: "var(--cream-dark)",
                        padding: 12,
                        borderRadius: "var(--radius)",
                        border: "1px solid var(--cream-border)",
                      }}
                    >
                      <input
                        autoFocus
                        value={newTaskLabel}
                        onChange={(e) => setNewTaskLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newTaskLabel.trim())
                            addCustomTask();
                          if (e.key === "Escape") setShowAddTask(false);
                        }}
                        placeholder="Task description... (required)"
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          fontSize: 13,
                          border: "1px solid var(--cream-border)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--cream)",
                          color: "var(--ink)",
                          fontFamily: "var(--font-body)",
                          outline: "none",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <input
                          value={newTaskTime}
                          onChange={(e) => setNewTaskTime(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTaskLabel.trim())
                              addCustomTask();
                            if (e.key === "Escape") setShowAddTask(false);
                          }}
                          placeholder="Time (e.g. 5:30 AM)"
                          style={{
                            flex: 1,
                            padding: "8px 12px",
                            fontSize: 13,
                            border: "1px solid var(--cream-border)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--cream)",
                            color: "var(--ink)",
                            fontFamily: "var(--font-body)",
                            outline: "none",
                          }}
                        />
                        <input
                          value={newTaskNote}
                          onChange={(e) => setNewTaskNote(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTaskLabel.trim())
                              addCustomTask();
                            if (e.key === "Escape") setShowAddTask(false);
                          }}
                          placeholder="Subtitle/Note"
                          style={{
                            flex: 2,
                            padding: "8px 12px",
                            fontSize: 13,
                            border: "1px solid var(--cream-border)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--cream)",
                            color: "var(--ink)",
                            fontFamily: "var(--font-body)",
                            outline: "none",
                          }}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          justifyContent: "flex-end",
                          marginTop: 4,
                        }}
                      >
                        <button
                          onClick={() => setShowAddTask(false)}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            border: "1px solid var(--cream-border)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--cream)",
                            color: "var(--ink-muted)",
                            cursor: "pointer",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={addCustomTask}
                          disabled={!newTaskLabel.trim()}
                          style={{
                            padding: "6px 12px",
                            fontSize: 12,
                            border: "none",
                            borderRadius: "var(--radius-sm)",
                            background: newTaskLabel.trim()
                              ? "var(--accent)"
                              : "var(--cream-border)",
                            color: "white",
                            cursor: newTaskLabel.trim()
                              ? "pointer"
                              : "not-allowed",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          Add Task
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddTask(true)}
                      style={{
                        width: "100%",
                        padding: "9px 0",
                        fontSize: 13,
                        border: "1px dashed var(--cream-border)",
                        borderRadius: "var(--radius-sm)",
                        background: "transparent",
                        color: "var(--ink-faint)",
                        cursor: "pointer",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      + Add custom task
                    </button>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 24,
                    display: "flex",
                    justifyContent: "center",
                  }}
                >
                  <button
                    onClick={() => {
                      setTemplateEditMode("edit");
                      setEditingTemplate(restDay ? "rest" : "study");
                    }}
                    style={{
                      padding: "6px 12px",
                      fontSize: 11,
                      border: "none",
                      background: "transparent",
                      color: "var(--ink-muted)",
                      cursor: "pointer",
                      textDecoration: "underline",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Edit prescription template
                  </button>
                </div>

                {progress === 1 && allItems.length > 0 && (
                  <div
                    style={{
                      marginTop: 20,
                      padding: "14px 16px",
                      background: "var(--green-bg)",
                      borderRadius: "var(--radius)",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 16,
                        color: "var(--green)",
                      }}
                    >
                      Day complete.
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--green)",
                        marginTop: 2,
                        opacity: 0.8,
                      }}
                    >
                      One more day closer to topnotcher.
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* milestones */}
        {activeTab === "milestones" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-muted)",
                marginBottom: 4,
              }}
            >
              Tap a date to edit it. Changes reflect everywhere in the app.
            </div>
            {milestones.map((m) => {
              const date = new Date(m.dateStr);
              const days = getDaysUntil(date);
              const editing = editingMilestone === m.id;
              return (
                <div
                  key={m.id}
                  style={{
                    padding: "14px 16px",
                    background: "var(--cream)",
                    border: "1px solid var(--cream-border)",
                    borderRadius: "var(--radius)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--ink)",
                        marginBottom: 4,
                      }}
                    >
                      {m.label}
                    </div>
                    {editing ? (
                      <input
                        type="date"
                        defaultValue={m.dateStr}
                        autoFocus
                        onBlur={(e) =>
                          updateMilestoneDate(m.id, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            updateMilestoneDate(
                              m.id,
                              (e.target as HTMLInputElement).value,
                            );
                          if (e.key === "Escape") setEditingMilestone(null);
                        }}
                        style={{
                          fontSize: 12,
                          padding: "4px 8px",
                          border: "1px solid var(--accent-light)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--cream-dark)",
                          color: "var(--ink)",
                          fontFamily: "var(--font-body)",
                          outline: "none",
                        }}
                      />
                    ) : (
                      <div
                        onClick={() => setEditingMilestone(m.id)}
                        style={{
                          fontSize: 11,
                          color: "var(--ink-faint)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {date.toLocaleDateString("en-PH", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--accent)",
                            opacity: 0.7,
                          }}
                        >
                          edit
                        </span>
                      </div>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      padding: "4px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: days < 0 ? "var(--cream-dark)" : m.bg,
                      color: days < 0 ? "var(--ink-faint)" : m.color,
                      flexShrink: 0,
                    }}
                  >
                    {days < 0 ? "Done" : days === 0 ? "Today" : `${days}d`}
                  </div>
                </div>
              );
            })}
            <div
              style={{
                marginTop: 8,
                padding: "14px 16px",
                background: "var(--accent-bg)",
                borderRadius: "var(--radius)",
                borderLeft: "3px solid var(--accent-light)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  marginBottom: 4,
                }}
              >
                Days to CBLEL exam
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 32,
                  color: "var(--accent)",
                }}
              >
                {getDaysUntil(examDate)}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-muted)",
                  marginTop: 2,
                }}
              >
                {examDate.toLocaleDateString("en-PH", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                · Get that License.
              </div>
            </div>
            <button
              onClick={() => {
                saveMilestones(DEFAULT_MILESTONES);
                setMilestones(DEFAULT_MILESTONES);
              }}
              style={{
                padding: "8px 0",
                fontSize: 12,
                border: "1px solid var(--cream-border)",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                color: "var(--ink-faint)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Reset to defaults
            </button>
          </div>
        )}

        {/* subjects */}
        {activeTab === "subjects" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div
              style={{
                fontSize: 12,
                color: "var(--ink-muted)",
                marginBottom: 4,
              }}
            >
              {cycleLength} days per subject · {studyDays.length} study days per
              week · repeating continuously
            </div>
            {subjects.map((s, i) => {
              const isCurrent =
                !restDay &&
                getSubjectForDate(
                  viewDate,
                  startDateStr,
                  subjects,
                  cycleLength,
                  studyDays,
                ).subject === s.name;
              return (
                <div
                  key={s.short}
                  style={{
                    padding: "12px 14px",
                    background: isCurrent ? "var(--accent-bg)" : "var(--cream)",
                    border: `1px solid ${isCurrent ? "var(--accent-light)" : "var(--cream-border)"}`,
                    borderRadius: "var(--radius-sm)",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: isCurrent
                        ? "var(--accent)"
                        : "var(--cream-border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 500,
                      color: isCurrent ? "white" : "var(--ink-muted)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                      {s.short} · {s.weight}% LLE Weight
                    </div>
                  </div>
                  {isCurrent && (
                    <div
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        padding: "2px 8px",
                        background: "var(--accent)",
                        color: "white",
                        borderRadius: 3,
                        fontWeight: 500,
                      }}
                    >
                      This week
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <Pomodoro />
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--cream-border)",
  background: "var(--cream)",
  cursor: "pointer",
  fontSize: 14,
  color: "var(--ink-muted)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-body)",
};
