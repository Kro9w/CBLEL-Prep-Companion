import { useState, useEffect } from "react";
import Dashboard from "./Dashboard";
import MockExam from "./MockExam";
import Onboarding from "./Onboarding";
import TourOverlay from "./TourOverlay";
import Pomodoro from "./Pomodoro";
import { BottomNav } from "./components/BottomNav";
import { MoreSheet } from "./components/MoreSheet";
import { SettingsPage } from "./components/SettingsPage";
import { StudyFeed } from "./components/StudyFeed";
import { AutoUpdater } from "./components/AutoUpdater";
import { loadJSON, saveJSON } from "./utils/storage";
import packageJson from "../package.json";

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
  tag:
    | "study"
    | "mock"
    | "leisure"
    | "rest"
    | "custom"
    | "priority"
    | "habit"
    | "exercise";
  custom?: boolean;
  dayOverrides?: Record<
    string,
    { omit?: boolean; label?: string; tag?: string; time?: string }
  >;
};

export const DEFAULT_REST_TEMPLATE: ChecklistItem[] = [];

export const DEFAULT_STUDY_TEMPLATE: ChecklistItem[] = [];

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
  priority: { label: "Priority", color: "var(--red)", bg: "var(--red-bg)" },
  habit: { label: "Habit", color: "var(--blue)", bg: "var(--blue-bg)" },
  exercise: {
    label: "Exercise",
    color: "var(--sienna)",
    bg: "var(--sienna-bg)",
  },
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
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestRelease, setLatestRelease] = useState<any>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const response = await fetch(
          "https://api.github.com/repos/Kro9w/CBLEL-Prep-Companion/releases/latest",
        );
        if (!response.ok) return;
        const data = await response.json();

        const currentParts = packageJson.version.split(".").map(Number);
        const remoteParts = data.tag_name
          .replace(/^v/, "")
          .split(".")
          .map(Number);

        let isNewer = false;
        for (
          let i = 0;
          i < Math.max(currentParts.length, remoteParts.length);
          i++
        ) {
          const c = currentParts[i] || 0;
          const r = remoteParts[i] || 0;
          if (r > c) {
            isNewer = true;
            break;
          }
          if (r < c) break;
        }

        if (isNewer) {
          setLatestRelease(data);
          setUpdateAvailable(true);
          setShowUpdateModal(true);
        }
      } catch (e) {
        console.error("Failed to check for updates", e);
      }
    };
    checkUpdate();
  }, []);

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      setTouchStartX(e.touches[0].clientX);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX === null) return;
      setTouchStartX(null);
    };
  }, [touchStartX]);

  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<
    | "dashboard"
    | "practice"
    | "study"
    | "checklist"
    | "milestones"
    | "subjects"
    | "settings"
  >("dashboard");

  const [previousTab, setPreviousTab] = useState<typeof activeTab>("dashboard");

  function switchTab(newTab: typeof activeTab) {
    if (activeTab !== "study" && newTab === "study") {
      setPreviousTab(activeTab);
    }
    setActiveTab(newTab);
  }

  function handleCloseStudy() {
    setActiveTab(previousTab);
  }
  const [darkMode, setDarkMode] = useState(() => {
    try {
      return localStorage.getItem("darkMode") === "true";
    } catch {
      return false;
    }
  });
  const [simpleFont, setSimpleFont] = useState(() => {
    try {
      return localStorage.getItem("simpleFont") === "true";
    } catch {
      return false;
    }
  });
  const [fontSize, setFontSize] = useState<"S" | "M" | "L">(() => {
    try {
      const saved = localStorage.getItem("fontSize");
      return saved === "S" || saved === "M" || saved === "L" ? saved : "M";
    } catch {
      return "M";
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneData[]>(loadMilestones);
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null);
  const [customTasks, setCustomTasks] = useState<ChecklistItem[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<string[]>([]);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [newTaskTime, setNewTaskTime] = useState("");
  const [newTaskNote, setNewTaskNote] = useState("");
  const [showAddTask, setShowAddTask] = useState(false);
  const [tourSeen, setTourSeen] = useState(() => loadJSON("tourSeen", false));

  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);

  const [prescriptionMode, setPrescriptionMode] = useState<
    ChecklistItem[] | null
  >(() => {
    return loadJSON("prescriptionMode", null);
  });

  const [checklistHeaderClicks, setChecklistHeaderClicks] = useState(0);
  const [dragOverApp, setDragOverApp] = useState(false);

  useEffect(() => {
    if (checklistHeaderClicks >= 5) {
      setChecklistHeaderClicks(0);
      if (prescriptionMode) return;
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (re) => {
          try {
            const json = JSON.parse(re.target?.result as string);
            setPrescriptionMode(json);
            saveJSON("prescriptionMode", json);
          } catch (err) {
            console.error("Failed to parse prescription file", err);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    }
  }, [checklistHeaderClicks]);

  const [studyStreak, setStudyStreak] = useState<number>(() =>
    loadJSON("studyStreak", 0),
  );
  const [enableStreak, setEnableStreak] = useState<boolean>(() =>
    loadJSON("enableStreak", true),
  );
  const [enablePomodoro, setEnablePomodoro] = useState<boolean>(() =>
    loadJSON("enablePomodoro", true),
  );

  function handleStudyAnswer(correct: boolean) {
    if (!enableStreak) return;
    setStudyStreak((prev) => {
      const next = correct ? prev + 1 : 0;
      saveJSON("studyStreak", next);
      return next;
    });
  }

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
    document.documentElement.setAttribute(
      "data-font-style",
      simpleFont ? "simple" : "serif",
    );
    try {
      localStorage.setItem("simpleFont", String(simpleFont));
    } catch {}
  }, [simpleFont]);

  useEffect(() => {
    document.documentElement.setAttribute("data-font-size", fontSize);
    try {
      localStorage.setItem("fontSize", fontSize);
    } catch {}
  }, [fontSize]);

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

  let baseItems: ChecklistItem[] = [];
  if (prescriptionMode) {
    const dayName = DAY_NAMES[viewDate.getDay()];
    const isWeekend = dayName === "Saturday" || dayName === "Sunday";

    baseItems = prescriptionMode
      .map((item) => {
        if (item.dayOverrides && item.dayOverrides[dayName]) {
          const override = item.dayOverrides[dayName];
          if (override.omit) return null;
          return {
            ...item,
            label: override.label || item.label,
            tag: (override.tag as any) || item.tag,
            time: override.time || item.time,
          };
        }
        return item;
      })
      .filter((item) => {
        if (!item) return false;
        if (isWeekend) {
          return item.tag === "habit" || item.tag === "rest";
        }
        return true;
      }) as ChecklistItem[];
  } else {
    baseItems = buildChecklist(
      viewDate,
      startDateStr,
      subjects,
      cycleLength,
      studyDays,
      DEFAULT_STUDY_TEMPLATE,
      DEFAULT_REST_TEMPLATE,
    ).filter((i) => !deletedTasks.includes(i.id));
  }

  const allItems = [...baseItems, ...customTasks].sort((a, b) => {
    if (a.tag === "priority" && b.tag !== "priority") return -1;
    if (a.tag !== "priority" && b.tag === "priority") return 1;
    return 0;
  });
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
      className="app-container"
      style={{
        height: "100dvh",
        width: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "var(--cream)",
        color: "var(--ink)",
        transition: "background 0.2s, color 0.2s",
      }}
    >
      <AutoUpdater
        show={showUpdateModal}
        latestRelease={latestRelease}
        onClose={() => setShowUpdateModal(false)}
      />
      {!tourSeen && (
        <TourOverlay
          onDismiss={() => {
            setTourSeen(true);
            saveJSON("tourSeen", true);
          }}
        />
      )}

      {/* ── header ── */}
      {activeTab !== "study" && (
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
          <div style={{ display: "flex", alignItems: "center" }}>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "calc(22px * var(--scale, 1))",
                  color: "var(--ink)",
                  lineHeight: 1.2,
                }}
              >
                {userName}'s Boards
              </div>
              <div
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
                  color: "var(--ink-faint)",
                  marginTop: 2,
                }}
              >
                CBLEL {examDate.getFullYear()} · The Licensed Librarian Roadmap
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {updateAvailable && !showUpdateModal && (
              <button
                onClick={() => setShowUpdateModal(true)}
                style={{
                  fontSize: "calc(11px * var(--scale, 1))",
                  fontWeight: 500,
                  padding: "2px 8px",
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Update available
              </button>
            )}
            {!restDay && (
              <span
                style={{
                  fontSize: "calc(11px * var(--scale, 1))",
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
                  fontSize: "calc(11px * var(--scale, 1))",
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
            <div className="desktop-settings" style={{ position: "relative" }}>
              <button
                onClick={() => setShowSettings((s) => !s)}
                title="Settings"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--cream-border)",
                  background: showSettings
                    ? "var(--cream-border)"
                    : "var(--cream-dark)",
                  cursor: "pointer",
                  fontSize: "calc(15px * var(--scale, 1))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ink-muted)",
                  transition: "background 0.15s",
                }}
              >
                ⚙
              </button>
              {showSettings && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 8,
                    width: 220,
                    background: "var(--cream)",
                    border: "1px solid var(--cream-border)",
                    borderRadius: "var(--radius)",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    padding: "16px",
                    zIndex: 1000,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  {/* Theme Toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "calc(13px * var(--scale, 1))",
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      Dark Mode
                    </span>
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      style={{
                        width: 40,
                        height: 22,
                        borderRadius: 12,
                        background: darkMode
                          ? "var(--accent)"
                          : "var(--cream-dark)",
                        border: "1px solid var(--cream-border)",
                        position: "relative",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: darkMode
                            ? "var(--cream)"
                            : "var(--ink-muted)",
                          position: "absolute",
                          top: 2,
                          left: darkMode ? 20 : 2,
                          transition: "left 0.2s",
                        }}
                      />
                    </button>
                  </div>

                  {/* Font Style */}
                  <div>
                    <div
                      style={{
                        fontSize: "calc(12px * var(--scale, 1))",
                        color: "var(--ink-muted)",
                        marginBottom: 6,
                      }}
                    >
                      Font Style
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => setSimpleFont(false)}
                        style={{
                          flex: 1,
                          padding: "6px",
                          fontSize: "calc(12px * var(--scale, 1))",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--cream-border)",
                          background: !simpleFont
                            ? "var(--accent-bg)"
                            : "var(--cream-dark)",
                          color: !simpleFont
                            ? "var(--accent)"
                            : "var(--ink-muted)",
                          fontFamily: "'Instrument Serif', Georgia, serif",
                          cursor: "pointer",
                        }}
                      >
                        Serif
                      </button>
                      <button
                        onClick={() => setSimpleFont(true)}
                        style={{
                          flex: 1,
                          padding: "6px",
                          fontSize: "calc(12px * var(--scale, 1))",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--cream-border)",
                          background: simpleFont
                            ? "var(--accent-bg)"
                            : "var(--cream-dark)",
                          color: simpleFont
                            ? "var(--accent)"
                            : "var(--ink-muted)",
                          fontFamily: "'Fraunces', Georgia, serif",
                          cursor: "pointer",
                        }}
                      >
                        Fraunces
                      </button>
                    </div>
                  </div>

                  {/* Font Size */}
                  <div>
                    <div
                      style={{
                        fontSize: "calc(12px * var(--scale, 1))",
                        color: "var(--ink-muted)",
                        marginBottom: 6,
                      }}
                    >
                      Text Size
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {(["S", "M", "L"] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setFontSize(s)}
                          style={{
                            flex: 1,
                            padding: "6px",
                            fontSize: `calc(${s === "S" ? 11 : s === "M" ? 13 : 15}px * var(--scale, 1))`,
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--cream-border)",
                            background:
                              fontSize === s
                                ? "var(--accent-bg)"
                                : "var(--cream-dark)",
                            color:
                              fontSize === s
                                ? "var(--accent)"
                                : "var(--ink-muted)",
                            cursor: "pointer",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gamification Settings */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderTop: "1px solid var(--cream-border)",
                      paddingTop: 16,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "calc(13px * var(--scale, 1))",
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      Study Cards Streak
                    </span>
                    <button
                      onClick={() => {
                        const val = !enableStreak;
                        setEnableStreak(val);
                        saveJSON("enableStreak", val);
                        if (!val) {
                          setStudyStreak(0);
                          saveJSON("studyStreak", 0);
                        }
                      }}
                      style={{
                        width: 40,
                        height: 22,
                        borderRadius: 12,
                        background: enableStreak
                          ? "var(--accent)"
                          : "var(--cream-dark)",
                        border: "1px solid var(--cream-border)",
                        position: "relative",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: enableStreak
                            ? "var(--cream)"
                            : "var(--ink-muted)",
                          position: "absolute",
                          top: 2,
                          left: enableStreak ? 20 : 2,
                          transition: "left 0.2s",
                        }}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* ── date nav ── */}
      {activeTab !== "dashboard" &&
        activeTab !== "practice" &&
        activeTab !== "study" && (
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
                  fontSize: "calc(16px * var(--scale, 1))",
                  color: "var(--ink)",
                }}
              >
                {formatDate(viewDate)}
              </div>
              {!isToday ? (
                <button
                  onClick={() => setViewDate(new Date())}
                  style={{
                    fontSize: "calc(11px * var(--scale, 1))",
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
                    fontSize: "calc(11px * var(--scale, 1))",
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
      {activeTab !== "study" && (
        <div
          className="desktop-tabs"
          style={{
            display: "flex",
            borderBottom: "1px solid var(--cream-border)",
            padding: "0 24px",
            overflowX: "auto",
          }}
        >
          {(
            [
              "dashboard",
              "practice",
              "study",
              "checklist",
              "milestones",
              "subjects",
            ] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                if (tab === "checklist" && activeTab === "checklist") {
                  setChecklistHeaderClicks((prev) => prev + 1);
                } else {
                  switchTab(tab);
                }
              }}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "calc(13px * var(--scale, 1))",
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
                textTransform: "capitalize",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* ── main ── */}
      <main
        key={activeTab}
        className="fade-in"
        style={{
          flex: 1,
          minHeight: 0 /* crucial for nested flex scrolling */,
          overflowY: activeTab === "study" ? "hidden" : "auto",
          padding:
            activeTab === "dashboard" ||
            activeTab === "practice" ||
            activeTab === "study"
              ? 0
              : "20px 24px",
          display: activeTab === "study" ? "flex" : "block",
          flexDirection: "column",
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
            onNavigateToPractice={() => switchTab("practice")}
          />
        )}
        {activeTab === "practice" && <MockExam isRestDay={restDay} />}

        {/* checklist */}
        {activeTab === "checklist" && (
          <div
            onDragOver={(e) => {
              if (prescriptionMode) return;
              e.preventDefault();
              setDragOverApp(true);
            }}
            onDragLeave={() => {
              if (prescriptionMode) return;
              setDragOverApp(false);
            }}
            onDrop={(e) => {
              if (prescriptionMode) return;
              e.preventDefault();
              setDragOverApp(false);
              const file = e.dataTransfer.files?.[0];
              if (!file || !file.name.endsWith(".json")) return;
              const reader = new FileReader();
              reader.onload = (re) => {
                try {
                  const json = JSON.parse(re.target?.result as string);
                  setPrescriptionMode(json);
                  saveJSON("prescriptionMode", json);
                } catch (err) {
                  console.error("Failed to parse prescription file", err);
                }
              };
              reader.readAsText(file);
            }}
            style={{
              height: "100%",
              width: "100%",
              position: "relative",
            }}
          >
            {dragOverApp && !prescriptionMode && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.1)",
                  border: "2px dashed var(--accent)",
                  borderRadius: "var(--radius)",
                  zIndex: 100,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                  fontSize: "1.2rem",
                  fontWeight: 500,
                }}
              >
                Drop prescription.json
              </div>
            )}
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
                    <span
                      style={{
                        fontSize: "calc(12px * var(--scale, 1))",
                        color: "var(--ink-muted)",
                      }}
                    >
                      {checkedCount} of {allItems.length} completed
                    </span>
                    <span
                      style={{
                        fontSize: "calc(12px * var(--scale, 1))",
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
                      fontSize: "calc(11px * var(--scale, 1))",
                      color: "var(--ink-faint)",
                      marginBottom: 2,
                    }}
                  >
                    {"This week's subject"}
                  </div>
                  <div
                    style={{
                      fontSize: "calc(14px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    {subject}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                            : item.tag === "priority"
                              ? "var(--red-bg)"
                              : "var(--cream)",
                          border:
                            item.tag === "priority" && !done
                              ? "1px solid var(--red)"
                              : "1px solid var(--cream-border)",
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
                                fontSize: "calc(13px * var(--scale, 1))",
                                fontWeight: 500,
                                color: "var(--ink)",
                                textDecoration: done ? "line-through" : "none",
                              }}
                            >
                              {item.label}
                            </span>
                            <span
                              style={{
                                fontSize: "calc(10px * var(--scale, 1))",
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
                                fontSize: "calc(11px * var(--scale, 1))",
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
                                fontSize: "calc(12px * var(--scale, 1))",
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
                          fontSize: "calc(16px * var(--scale, 1))",
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
                      fontSize: "calc(12px * var(--scale, 1))",
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

              {/* add custom task or eject */}
              <div style={{ marginTop: 16 }}>
                {prescriptionMode ? (
                  <button
                    onClick={() => {
                      setPrescriptionMode(null);
                      try {
                        localStorage.removeItem("prescriptionMode");
                      } catch (err) {}
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 0",
                      fontSize: "calc(13px * var(--scale, 1))",
                      border: "1px dashed var(--red)",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--red-bg)",
                      color: "var(--red)",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Eject Prescription
                  </button>
                ) : showAddTask ? (
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
                        fontSize: "calc(13px * var(--scale, 1))",
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
                          fontSize: "calc(13px * var(--scale, 1))",
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
                          fontSize: "calc(13px * var(--scale, 1))",
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
                          fontSize: "calc(12px * var(--scale, 1))",
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
                          fontSize: "calc(12px * var(--scale, 1))",
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
                      fontSize: "calc(13px * var(--scale, 1))",
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
                      fontSize: "calc(16px * var(--scale, 1))",
                      color: "var(--green)",
                    }}
                  >
                    Day complete.
                  </div>
                  <div
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
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
          </div>
        )}

        {/* milestones */}
        {activeTab === "milestones" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontSize: "calc(12px * var(--scale, 1))",
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
                        fontSize: "calc(13px * var(--scale, 1))",
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
                          fontSize: "calc(12px * var(--scale, 1))",
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
                          fontSize: "calc(11px * var(--scale, 1))",
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
                            fontSize: "calc(10px * var(--scale, 1))",
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
                      fontSize: "calc(13px * var(--scale, 1))",
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
                  fontSize: "calc(11px * var(--scale, 1))",
                  color: "var(--ink-faint)",
                  marginBottom: 4,
                }}
              >
                Days to CBLEL exam
              </div>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "calc(32px * var(--scale, 1))",
                  color: "var(--accent)",
                }}
              >
                {getDaysUntil(examDate)}
              </div>
              <div
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
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
                fontSize: "calc(12px * var(--scale, 1))",
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
                fontSize: "calc(12px * var(--scale, 1))",
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
                      fontSize: "calc(11px * var(--scale, 1))",
                      fontWeight: 500,
                      color: isCurrent ? "white" : "var(--ink-muted)",
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "calc(13px * var(--scale, 1))",
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      {s.name}
                    </div>
                    <div
                      style={{
                        fontSize: "calc(11px * var(--scale, 1))",
                        color: "var(--ink-faint)",
                      }}
                    >
                      {s.short} · {s.weight}% LLE Weight
                    </div>
                  </div>
                  {isCurrent && (
                    <div
                      style={{
                        marginLeft: "auto",
                        fontSize: "calc(10px * var(--scale, 1))",
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

        {/* settings */}
        {activeTab === "settings" && (
          <SettingsPage
            updateAvailable={updateAvailable}
            latestRelease={latestRelease}
            onOpenUpdateModal={() => setShowUpdateModal(true)}
            darkMode={darkMode}
            setDarkMode={setDarkMode}
            simpleFont={simpleFont}
            setSimpleFont={setSimpleFont}
            fontSize={fontSize}
            setFontSize={setFontSize}
            enableStreak={enableStreak}
            setEnableStreak={(val: boolean) => {
              setEnableStreak(val);
              saveJSON("enableStreak", val);
              if (!val) {
                setStudyStreak(0);
                saveJSON("studyStreak", 0);
              }
            }}
            enablePomodoro={enablePomodoro}
            setEnablePomodoro={(val: boolean) => {
              setEnablePomodoro(val);
              saveJSON("enablePomodoro", val);
            }}
          />
        )}

        {/* study */}
        {activeTab === "study" && (
          <StudyFeed
            onAnswer={handleStudyAnswer}
            studyStreak={studyStreak}
            enableStreak={enableStreak}
            onClose={handleCloseStudy}
          />
        )}
      </main>

      {enablePomodoro && activeTab !== "study" && activeTab !== "practice" && (
        <Pomodoro />
      )}
      <BottomNav
        activeTab={activeTab}
        setActiveTab={switchTab}
        onMoreClick={() => setIsMoreSheetOpen(true)}
        studyStreak={studyStreak}
        enableStreak={enableStreak}
      />
      <MoreSheet
        isOpen={isMoreSheetOpen}
        onClose={() => setIsMoreSheetOpen(false)}
        activeTab={activeTab}
        setActiveTab={switchTab}
      />
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
  fontSize: "calc(14px * var(--scale, 1))",
  color: "var(--ink-muted)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-body)",
};
