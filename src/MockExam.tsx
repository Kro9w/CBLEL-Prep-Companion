import { useState, useRef, useCallback, useEffect } from "react";
import { loadSubjects } from "./App";
import { quizCompletedKey } from "./Dashboard";
import { loadJSON, updateRecentlySeenQuestions } from "./utils/storage";
import { P2P_SESSIONS } from "./utils/p2pConstants";
import { Users } from "lucide-react";
import { getAnonymousUuid } from "./utils/storage";
import { ShelvingInteractive } from "./components/ShelvingInteractive";
import { generateVariations } from "./components/CallNumberGenerator";

// ── types
export type SessionType =
  | "exam"
  | "quiz"
  | "custom"
  | "classification"
  | "p2p"
  | "shelving";

export type Option = { letter: string; text: string; correct: boolean };
export type Question = {
  number: number;
  stem: string;
  options: Option[];
  explanation?: string;
};
type SessionMode = "immediate" | "end";
type ExamPhase = "load" | "configure" | "exam" | "review" | "history";

type WrongItem = {
  number: number;
  stem: string;
  chosen: string | undefined;
  chosenText?: string;
  correctLetter: string;
  correctText: string;
  explanation?: string;
};

type SavedExam = {
  id: string; // e.g. "LOM_1-2026-04-25T14:32"
  examCode: string; // e.g. "LOM_1"
  date: string; // ISO string
  score: number; // 0-100
  correct: number;
  total: number;
  timeTaken: number; // seconds
  mode: SessionMode;
  wrong: WrongItem[];
  sessionType?: SessionType;
};

// ── subject short codes
const SUBJECT_SHORTS: Record<string, string> = {
  LOM: "LOM",
  RBU: "RBU",
  CC: "CC",
  IA: "IA",
  CM: "CM",
  IT: "IT",
};

// ── item parser
function parseExamCode(raw: string): string {
  const firstLine =
    raw
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0) || "";
  const match = firstLine.match(/^([A-Z]{2,6}_\d+)$/i);
  return match ? match[1].toUpperCase() : "";
}

export function parseQuestions(
  raw: string,
  isP2p: boolean = false,
): Question[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const questions: Question[] = [];
  let current: (Partial<Question> & { options: Option[] }) | null = null;

  const questionReOld = /^(\d+)[.)]\s+(.+)$/;
  const questionReNew = /^Q\.\s+(.+)$/i;
  const optionReOld = /^(\*?)([A-Da-d])[.)]\s+(.+)$/;
  const optionReNew = /^(\*?)O\.\s+(.+)$/i;
  const explanationRe = /^Y:\s+(.+)$/i;
  const examCodeRe = /^[A-Z]{2,6}_[A-Z0-9]+$/i;

  let questionCounter = 1;

  for (const line of lines) {
    if (examCodeRe.test(line)) continue;

    const qMatchOld = line.match(questionReOld);
    const qMatchNew = line.match(questionReNew);
    const oMatchOld = line.match(optionReOld);
    const oMatchNew = line.match(optionReNew);
    const yMatch = line.match(explanationRe);

    if (qMatchOld || qMatchNew) {
      if (current && current.stem && current.options.length > 0)
        questions.push(current as Question);

      const stemText = qMatchOld ? qMatchOld[2] : qMatchNew ? qMatchNew[1] : "";

      let questionNumber = questionCounter++;
      if (isP2p && qMatchOld) {
        questionNumber = parseInt(qMatchOld[1], 10);
      } else if (isP2p && qMatchNew) {
        // We already assigned questionNumber = questionCounter++, which is correct for Q. format!
        // No explicit digit assignment needed.
      }

      current = { number: questionNumber, stem: stemText, options: [] };
    } else if ((oMatchOld || oMatchNew) && current) {
      const isCorrect = oMatchOld
        ? oMatchOld[1] === "*"
        : oMatchNew![1] === "*";
      const text = oMatchOld ? oMatchOld[3].trim() : oMatchNew![2].trim();

      let letter = "A";
      if (oMatchOld) {
        letter = oMatchOld[2].toUpperCase();
      } else {
        const letters = ["A", "B", "C", "D"];
        letter = letters[current.options.length] || "?";
      }

      current.options.push({
        letter,
        text,
        correct: isCorrect,
      });
    } else if (yMatch && current) {
      current.explanation = yMatch[1].trim();
    } else if (
      current &&
      !qMatchOld &&
      !qMatchNew &&
      !oMatchOld &&
      !oMatchNew &&
      !yMatch &&
      line.length > 0
    ) {
      if (current.explanation) {
        current.explanation += " " + line;
      } else {
        current.stem += " " + line;
      }
    }
  }
  if (current && current.stem && current.options.length > 0)
    questions.push(current as Question);
  return questions;
}

// ── logic helpers
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function processQuestionsSubset(
  allQuestions: Question[],
  count: number,
  isP2p: boolean = false,
): Question[] {
  const recent = loadJSON<string[]>("recentlySeenQuestions", []);

  let subset: Question[];

  if (isP2p) {
    subset = allQuestions.slice(0, count);
  } else {
    // Shuffle everything completely randomly
    let shuffled = shuffleArray(allQuestions);
    shuffled.sort((a, b) => {
      const aSeen = recent.includes(a.stem);
      const bSeen = recent.includes(b.stem);
      if (!aSeen && bSeen) return -1;
      if (aSeen && !bSeen) return 1;
      return 0;
    });
    subset = shuffled.slice(0, count);
  }

  updateRecentlySeenQuestions(subset.map((q) => q.stem));

  return subset.map((q, idx) => {
    // Options are ALWAYS shuffled. For P2P we preserve the original question order, but not choices.
    const processedOptions = shuffleArray(q.options);

    const finalOptions = processedOptions.map((opt, oIdx) => {
      const letters = ["A", "B", "C", "D", "E", "F"];
      return { ...opt, letter: letters[oIdx] || "?" };
    });

    const number = isP2p ? q.number : idx + 1;
    return { ...q, number, options: finalOptions };
  });
}

// ── storage helpers
const EXAMS_KEY = "saved-exams";
const WEBHOOK_QUEUE_KEY = "p2p-webhook-queue";

function queueFailedWebhook(payload: any) {
  try {
    const s = localStorage.getItem(WEBHOOK_QUEUE_KEY);
    const queue = s ? JSON.parse(s) : [];
    queue.push(payload);
    localStorage.setItem(WEBHOOK_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}

function flushWebhookQueue() {
  const webhookUrl = import.meta.env.VITE_WEBHOOK_URL;
  if (!webhookUrl || !navigator.onLine) return;

  try {
    const s = localStorage.getItem(WEBHOOK_QUEUE_KEY);
    const queue: any[] = s ? JSON.parse(s) : [];
    if (queue.length === 0) return;

    // We can't await inside a forEach natively, but since it's no-cors we can just fire them all off
    queue.forEach((payload) => {
      fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).catch(() => {});
    });

    // Clear queue after attempting flush
    localStorage.removeItem(WEBHOOK_QUEUE_KEY);
  } catch {}
}

window.addEventListener("online", flushWebhookQueue);

function scoreKey(date: Date) {
  return `score-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
function saveJSON(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}
function loadSavedExams(): SavedExam[] {
  try {
    const s = localStorage.getItem(EXAMS_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}
function appendSavedExam(exam: SavedExam) {
  const exams = loadSavedExams();
  exams.unshift(exam); // newest first
  try {
    localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
  } catch {}
}

// ── format helpers
function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDateDisplay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function scoreColor(pct: number): string {
  return pct >= 90
    ? "var(--green)"
    : pct >= 75
      ? "var(--blue)"
      : pct >= 50
        ? "var(--accent)"
        : "var(--red)";
}
function scoreBg(pct: number): string {
  return pct >= 90
    ? "var(--green-bg)"
    : pct >= 75
      ? "var(--blue-bg)"
      : pct >= 50
        ? "var(--accent-bg)"
        : "var(--red-bg)";
}
function scoreLabel(pct: number): string {
  return pct >= 90
    ? "Topnotcher 🎯"
    : pct >= 75
      ? "Passing ✓"
      : pct >= 50
        ? "Keep pushing"
        : "Review needed";
}

// ── progress bar
function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div
        style={{
          flex: 1,
          height: 3,
          background: "var(--cream-border)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 2,
            width: `${(current / total) * 100}%`,
            background: "var(--accent)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "calc(11px * var(--scale, 1))",
          color: "var(--ink-faint)",
          flexShrink: 0,
        }}
      >
        {current}/{total}
      </span>
    </div>
  );
}

// ── timer display
function TimerDisplay({ elapsed, limit }: { elapsed: number; limit: number }) {
  const remaining = limit - Math.min(elapsed, limit);
  const pct = remaining / limit;
  const urgent = remaining <= 300;
  const critical = remaining <= 60;
  const color = critical
    ? "#8B3A3A"
    : urgent
      ? "var(--accent)"
      : "var(--ink-muted)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          width: 80,
          height: 3,
          background: "var(--cream-border)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct * 100}%`,
            background: critical
              ? "#8B3A3A"
              : urgent
                ? "var(--accent-light)"
                : "var(--cream-border)",
            borderRadius: 2,
            transition: "width 1s linear",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "calc(12px * var(--scale, 1))",
          fontWeight: 500,
          color,
          fontVariantNumeric: "tabular-nums",
          minWidth: 36,
        }}
      >
        {formatTime(remaining)}
      </span>
    </div>
  );
}

// Custom slider helper component used by the settings UI
interface CustomSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
}

function CustomSlider({ min, max, value, onChange }: CustomSliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) =>
        onChange(parseInt((e.target as HTMLInputElement).value, 10))
      }
      style={{
        width: "100%",
        cursor: "pointer",
        accentColor: "var(--accent)",
        WebkitAppearance: "none",
        appearance: "none",
        height: "6px",
        borderRadius: "3px",
        background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${percentage}%, var(--cream) ${percentage}%, var(--cream-dark) 100%)`,
      }}
    />
  );
}

// ── wrong answer review block (shared by review + history)
function WrongReview({ wrong }: { wrong: WrongItem[] }) {
  if (wrong.length === 0)
    return (
      <div style={{ textAlign: "center", padding: "24px 0" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "calc(18px * var(--scale, 1))",
            color: "var(--green)",
            marginBottom: 6,
          }}
        >
          Perfect score.
        </div>
        <div
          style={{
            fontSize: "calc(13px * var(--scale, 1))",
            color: "var(--ink-muted)",
          }}
        >
          Every single answer was correct.
        </div>
      </div>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {wrong.map((w, idx) => (
        <div
          key={idx}
          style={{
            background: "var(--cream)",
            border: "1px solid var(--cream-border)",
            borderRadius: "var(--radius)",
            padding: "14px 16px",
          }}
        >
          <div
            style={{
              fontSize: "calc(11px * var(--scale, 1))",
              color: "var(--ink-faint)",
              marginBottom: 6,
            }}
          >
            Q{w.number}
          </div>
          <div
            style={{
              fontSize: "calc(13px * var(--scale, 1))",
              fontWeight: 500,
              color: "var(--ink)",
              marginBottom: 10,
              lineHeight: 1.5,
            }}
          >
            {w.stem}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {w.chosen && w.chosen !== w.correctLetter && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 12px",
                  background: "var(--red-bg)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <span
                  style={{
                    fontSize: "calc(10px * var(--scale, 1))",
                    fontWeight: 500,
                    padding: "2px 6px",
                    borderRadius: 3,
                    flexShrink: 0,
                    background: "var(--red)",
                    color: "white",
                  }}
                >
                  ✗ {w.chosen}
                </span>
                <span
                  style={{
                    fontSize: "calc(12px * var(--scale, 1))",
                    color: "var(--red)",
                    lineHeight: 1.5,
                  }}
                >
                  {w.chosenText
                    ? `${w.chosenText} — your answer`
                    : "Your answer"}
                </span>
              </div>
            )}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "8px 12px",
                background: "var(--green-bg)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              <span
                style={{
                  fontSize: "calc(10px * var(--scale, 1))",
                  fontWeight: 500,
                  padding: "2px 6px",
                  borderRadius: 3,
                  flexShrink: 0,
                  background: "var(--green)",
                  color: "white",
                }}
              >
                ✓ {w.correctLetter}
              </span>
              <span
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
                  color: "var(--green)",
                  lineHeight: 1.5,
                }}
              >
                {w.correctText} — correct answer
              </span>
            </div>
            {w.explanation && (
              <div
                style={{
                  marginTop: 6,
                  padding: "10px 12px",
                  background: "var(--cream-dark)",
                  borderLeft: "2px solid var(--accent)",
                  borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                  fontSize: "calc(12px * var(--scale, 1))",
                  color: "var(--ink-muted)",
                  lineHeight: 1.5,
                }}
              >
                <strong>Explanation:</strong> {w.explanation}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── previous exams view
function PreviousExams({ filterType }: { filterType: "exam" | "quiz" }) {
  const [allExams, setAllExams] = useState<SavedExam[]>(loadSavedExams);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const exams = allExams.filter((e) =>
    filterType === "exam"
      ? e.sessionType === "exam" ||
        e.sessionType === "custom" ||
        e.sessionType === "p2p"
      : e.sessionType === "quiz",
  );

  function deleteExam(id: string) {
    const next = allExams.filter((e) => e.id !== id);
    setAllExams(next);
    try {
      localStorage.setItem(EXAMS_KEY, JSON.stringify(next));
    } catch {}
    setConfirmDelete(null);
    setExpanded(null);
  }

  const allSubjects = loadSubjects();

  if (exams.length === 0)
    return (
      <div style={{ padding: "32px 24px", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "calc(18px * var(--scale, 1))",
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          {filterType === "exam"
            ? "No exams saved yet."
            : "No quizzes saved yet."}
        </div>
        <div
          style={{
            fontSize: "calc(13px * var(--scale, 1))",
            color: "var(--ink-muted)",
          }}
        >
          After finishing {filterType === "exam" ? "an exam" : "a quiz"}, save
          it to see it here.
        </div>
      </div>
    );

  return (
    <div
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontSize: "calc(12px * var(--scale, 1))",
          color: "var(--ink-muted)",
          marginBottom: 4,
        }}
      >
        {exams.length} {filterType === "exam" ? "exam" : "quiz"}
        {exams.length !== 1 ? (filterType === "exam" ? "s" : "zes") : ""} saved
      </div>
      {exams.map((exam) => {
        const isOpen = expanded === exam.id;
        const isConfirm = confirmDelete === exam.id;

        const matchedSubject = allSubjects.find((s) =>
          exam.examCode.toUpperCase().startsWith(s.short),
        );
        let displayName = matchedSubject
          ? `${matchedSubject.name} · ${exam.examCode}`
          : exam.examCode;
        if (exam.sessionType === "custom") {
          displayName = `Custom Exam · ${exam.examCode}`;
        } else if (exam.sessionType === "p2p") {
          const type = exam.examCode.includes("_PRE")
            ? "Pre-Exam"
            : "Post-Exam";
          displayName = matchedSubject
            ? `P2P Session · ${matchedSubject.short} ${type}`
            : `P2P Session · ${exam.examCode}`;
        } else if (exam.sessionType === "quiz") {
          displayName = matchedSubject
            ? `${matchedSubject.name} · Quiz`
            : `${exam.examCode}`;
        }

        return (
          <div
            key={exam.id}
            style={{
              background: "var(--cream)",
              border: "1px solid var(--cream-border)",
              borderRadius: "var(--radius)",
              overflow: "hidden",
            }}
          >
            {/* header row */}
            <div
              onClick={() => setExpanded(isOpen ? null : exam.id)}
              style={{
                padding: "12px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
            >
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: "calc(13px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    {displayName}
                  </span>
                  <span
                    style={{
                      fontSize: "calc(10px * var(--scale, 1))",
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: scoreBg(exam.score),
                      color: scoreColor(exam.score),
                      fontWeight: 500,
                    }}
                  >
                    {scoreLabel(exam.score)}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "calc(11px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                  }}
                >
                  {formatDateDisplay(exam.date)} · {formatTime(exam.timeTaken)}{" "}
                  taken
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "calc(22px * var(--scale, 1))",
                    color: scoreColor(exam.score),
                    lineHeight: 1,
                  }}
                >
                  {exam.score}
                </div>
                <div
                  style={{
                    fontSize: "calc(10px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                  }}
                >
                  {exam.correct}/{exam.total}
                </div>
              </div>
              <div
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
                  color: "var(--ink-faint)",
                  marginLeft: 4,
                }}
              >
                {isOpen ? "▲" : "▼"}
              </div>
            </div>

            {/* expanded content */}
            {isOpen && (
              <div
                style={{
                  borderTop: "1px solid var(--cream-border)",
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 14,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      fontSize: "calc(11px * var(--scale, 1))",
                      padding: "3px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--cream-dark)",
                      color: "var(--ink-muted)",
                    }}
                  >
                    Mode:{" "}
                    {exam.mode === "immediate"
                      ? "Immediate feedback"
                      : "Full exam"}
                  </div>
                  <div
                    style={{
                      fontSize: "calc(11px * var(--scale, 1))",
                      padding: "3px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--cream-dark)",
                      color: "var(--ink-muted)",
                    }}
                  >
                    {exam.wrong.length} wrong
                  </div>
                  <div
                    style={{
                      fontSize: "calc(11px * var(--scale, 1))",
                      padding: "3px 10px",
                      borderRadius: "var(--radius-sm)",
                      background: "var(--cream-dark)",
                      color: "var(--ink-muted)",
                    }}
                  >
                    Time: {formatTime(exam.timeTaken)}
                  </div>
                </div>

                {exam.wrong.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: "calc(12px * var(--scale, 1))",
                        fontWeight: 500,
                        color: "var(--ink)",
                        marginBottom: 10,
                      }}
                    >
                      Incorrect answers — {exam.wrong.length}
                    </div>
                    <WrongReview wrong={exam.wrong} />
                  </>
                )}
                {exam.wrong.length === 0 && (
                  <div
                    style={{
                      fontSize: "calc(13px * var(--scale, 1))",
                      color: "#3D6B4F",
                      fontStyle: "italic",
                    }}
                  >
                    All answers correct.
                  </div>
                )}

                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  {isConfirm ? (
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span
                        style={{
                          fontSize: "calc(12px * var(--scale, 1))",
                          color: "var(--ink-muted)",
                        }}
                      >
                        Delete this record?
                      </span>
                      <button
                        onClick={() => deleteExam(exam.id)}
                        style={{
                          ...smallBtn,
                          background: "var(--red-bg)",
                          color: "var(--red)",
                          border: "1px solid var(--red)",
                        }}
                      >
                        Yes, delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={smallBtn}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(exam.id)}
                      style={{ ...smallBtn, color: "var(--ink-faint)" }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── main component
export default function MockExam({ isRestDay }: { isRestDay: boolean }) {
  const [view, setView] = useState<
    "exam" | "history-exams" | "history-quizzes" | "p2p-sessions" | "shelving"
  >("exam");
  const [phase, setPhase] = useState<ExamPhase>("load");
  const [sessionType, setSessionType] = useState<SessionType>("exam");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examCode, setExamCode] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [mode, setMode] = useState<SessionMode>("end");
  const [dragOver, setDragOver] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [showClassifications, setShowClassifications] = useState(false);
  const [classificationType, setClassificationType] = useState<
    "DDC" | "LCC" | "MARC" | null
  >(null);
  const [classificationCount, setClassificationCount] = useState(15);
  const [showShelving, setShowShelving] = useState(false);
  const [shelvingType, setShelvingType] = useState<"DDC" | "LCC" | null>(null);
  const [shelvingCount, setShelvingCount] = useState(5);
  const [shelvingItems, setShelvingItems] = useState<{
    original: string[];
    shuffled: string[];
  } | null>(null);
  const [showUploadErrorModal, setShowUploadErrorModal] = useState<
    string | null
  >(null);
  const [showP2pModal, setShowP2pModal] = useState<
    (typeof P2P_SESSIONS)[0] | null
  >(null);
  const [p2pPassword, setP2pPassword] = useState("");
  const [p2pError, setP2pError] = useState("");
  const [subjectSelector, setSubjectSelector] = useState<{
    show: boolean;
    count: number;
  }>({ show: false, count: 0 });
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // rest day modal state
  const [restModalAction, setRestModalAction] = useState<(() => void) | null>(
    null,
  );

  // exam state
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [showBookmarksModal, setShowBookmarksModal] = useState(false);

  // timer
  const [elapsed, setElapsed] = useState(0);
  const [examStartTime, setExamStartTime] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const examDuration = sessionType === "p2p" ? 7200 : 3600;

  // saved result (for save prompt)
  const [pendingExam, setPendingExam] = useState<SavedExam | null>(null);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // stop timer on unmount
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
    },
    [],
  );

  function startTimer() {
    setElapsed(0);
    setExamStartTime(new Date());
    timerRef.current = setInterval(() => {
      setElapsed((e) => {
        if (e + 1 >= examDuration) {
          clearInterval(timerRef.current!);
          // auto-finish via ref to avoid stale closure via a flag
          return examDuration;
        }
        return e + 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  // watch elapsed to auto-finish when time runs out
  useEffect(() => {
    if (elapsed >= examDuration && phase === "exam") {
      finishExam(elapsed);
    }
  }, [elapsed, phase, examDuration]);

  // ── file loading
  function proceedAction(action: () => void) {
    if (isRestDay) {
      setRestModalAction(() => action);
    } else {
      action();
    }
  }

  function handleFile(file: File) {
    if (!file.name.endsWith(".txt")) {
      setShowUploadErrorModal("Please upload a .txt file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const code = parseExamCode(text);
      const parsed = parseQuestions(text);

      if (!code) {
        setShowUploadErrorModal(
          "Invalid format: Missing or invalid exam code. Ensure the file contains a subject code at the top (e.g., LOM_1).",
        );
        return;
      }
      if (parsed.length !== 100) {
        setShowUploadErrorModal(
          `Invalid format: A custom mock exam must contain exactly 100 questions. Found ${parsed.length} questions.`,
        );
        return;
      }

      const shuffledParsed = processQuestionsSubset(parsed, parsed.length);
      setQuestions(shuffledParsed);
      setExamCode(code);
      setFileName(file.name);
      setParseError("");
      setSessionType("custom");
      setPhase("configure");
    };
    reader.readAsText(file);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  async function startP2pExam(session: (typeof P2P_SESSIONS)[0]) {
    try {
      setParseError("");
      const res = await fetch(`P2PQS/${session.code}.txt`);
      if (!res.ok) {
        setP2pError("Could not load question bank.");
        return;
      }
      const text = await res.text();
      let code = session.code;

      const parsedAll = parseQuestions(text, true);
      if (parsedAll.length === 0) {
        setP2pError("No valid P2P questions found.");
        return;
      }

      // For P2P we take the first 100 questions or all if less than 100
      const count = Math.min(parsedAll.length, 100);
      const subset = processQuestionsSubset(parsedAll, count, true);

      setQuestions(subset);
      setExamCode(code);
      setFileName(`P2P_${session.code}.txt`);
      setSessionType("p2p");
      setMode("end");
      setPhase("configure");
      setShowP2pModal(null);
      setP2pPassword("");
    } catch (err) {
      setP2pError("Error starting P2P exam.");
    }
  }

  async function fetchBuiltIn(
    subjectShort: string,
    count: number,
    isQuiz: boolean = false,
  ) {
    try {
      setParseError("");
      const res = await fetch(`QBank_${subjectShort}.txt`);
      if (!res.ok) {
        setParseError(
          `Could not load QBank_${subjectShort}.txt. Make sure the file exists in the public directory.`,
        );
        return;
      }
      const text = await res.text();
      let code = parseExamCode(text);
      if (!code) code = `${subjectShort}_1`; // Fallback code

      const parsedAll = parseQuestions(text);
      if (parsedAll.length === 0) {
        setParseError(
          "Under construction. Questions for this subject will be added in a future update.",
        );
        return;
      }

      const subset = processQuestionsSubset(parsedAll, count);

      setQuestions(subset);
      setExamCode(code);
      setFileName(`QBank_${subjectShort}.txt`);
      setSessionType(isQuiz ? "quiz" : "exam");
      setPhase("configure");
      setSubjectSelector({ show: false, count: 0 });
    } catch (err) {
      setParseError("Error fetching question bank: " + String(err));
    }
  }

  // ── exam logic
  function startExam() {
    setCurrent(0);
    setAnswers({});
    setRevealed({});
    setBookmarks([]);
    setPendingExam(null);
    setSaved(false);
    setPhase("exam");
    startTimer();
  }

  function choose(letter: string) {
    if (answers[current] !== undefined && mode === "immediate") return;
    setAnswers((prev) => ({ ...prev, [current]: letter }));
    if (mode === "immediate")
      setRevealed((prev) => ({ ...prev, [current]: true }));
  }

  function next() {
    if (current < questions.length - 1) setCurrent((c) => c + 1);
    else setShowFinishConfirm(true);
  }
  function prev() {
    if (current > 0) setCurrent((c) => c - 1);
  }

  function finishExam(timeTaken: number) {
    stopTimer();
    // compute results using current answers state directly
    const currentAnswers = answers;
    const correct = questions.filter((q, i) => {
      const chosen = currentAnswers[i];
      return chosen && q.options.find((o) => o.letter === chosen)?.correct;
    }).length;
    const score = Math.round((correct / questions.length) * 100);

    // Log differently based on session type
    if (sessionType === "exam" || sessionType === "custom") {
      saveJSON(scoreKey(new Date()), score);
    } else if (sessionType !== "p2p") {
      saveJSON(quizCompletedKey(new Date()), true);
    }

    const wrong: WrongItem[] = questions
      .map((q, i) => {
        const chosen = currentAnswers[i];
        const chosenOpt = q.options.find((o) => o.letter === chosen);
        const correctOpt = q.options.find((o) => o.correct);
        const isWrong =
          !chosen || !q.options.find((o) => o.letter === chosen)?.correct;
        if (!isWrong) return null;
        return {
          number: q.number,
          stem: q.stem,
          chosen,
          chosenText: chosenOpt?.text,
          correctLetter: correctOpt?.letter || "",
          correctText: correctOpt?.text || "",
          explanation: q.explanation,
        };
      })
      .filter(Boolean) as WrongItem[];

    const examRecord: SavedExam = {
      id: `${examCode || "EXAM"}-${Date.now()}`,
      examCode: examCode || fileName.replace(".txt", ""),
      date: new Date().toISOString(),
      score,
      correct,
      total: questions.length,
      timeTaken,
      mode,
      wrong,
      sessionType,
    };

    if (sessionType === "p2p") {
      const uuid = getAnonymousUuid();
      const payload = {
        uuid,
        sessionCode: examRecord.examCode,
        score,
        correct,
        total: questions.length,
        wrongItems: wrong.map((w) => w.number), // array of wrong question numbers
        timeTaken,
      };
      const webhookUrl = import.meta.env.VITE_WEBHOOK_URL;
      if (webhookUrl) {
        if (navigator.onLine) {
          fetch(webhookUrl, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).catch(() => {
            // Queue if fetch fails (e.g. proxy block but technically online)
            queueFailedWebhook(payload);
          });
        } else {
          // Queue immediately if offline
          queueFailedWebhook(payload);
        }
      }

      appendSavedExam(examRecord); // Auto save for their personal dashboard
    }

    setPendingExam(examRecord);
    setPhase("review");
  }

  function saveExam() {
    if (pendingExam) {
      appendSavedExam(pendingExam);
      setSaved(true);
    }
  }

  function reset() {
    stopTimer();
    setPhase("load");
    setQuestions([]);
    setFileName("");
    setExamCode("");
    setAnswers({});
    setRevealed({});
    setElapsed(0);
    setPendingExam(null);
    setSaved(false);
  }

  async function fetchClassification(
    type: "DDC" | "LCC" | "MARC",
    difficulty: "Easy" | "Hard" | "Tags" | "Subfields" | "Both",
    count: number,
  ) {
    try {
      setParseError("");
      const filename = `${type}.txt`;
      const res = await fetch(filename);
      if (!res.ok) {
        setParseError(
          `Could not load ${filename}. Make sure the file exists in the public directory.`,
        );
        return;
      }
      const text = await res.text();

      const items: { code: string; description: string }[] = [];
      const marcTags: { code: string; description: string }[] = [];
      const marcSubfields: {
        tagCode: string;
        tagDesc: string;
        code: string;
        description: string;
      }[] = [];

      const lines = text.split("\n").map((l) => l.trim());

      let inEasyHeader = false;
      let currentMarcTag: { code: string; description: string } | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (type === "MARC") {
          // Parse MARC tags e.g. "100 = Main Entry – Personal Name"
          const tagMatch = line.match(/^(\d{3})\s*=\s*(.+)$/);
          if (tagMatch) {
            currentMarcTag = {
              code: tagMatch[1].trim(),
              description: tagMatch[2].trim(),
            };
            marcTags.push(currentMarcTag);
          } else if (line.startsWith("$") && currentMarcTag) {
            // Parse MARC subfields e.g. "$a = Personal name"
            const subMatch = line.match(/^(\$[a-z0-9])\s*=\s*(.+)$/);
            if (subMatch) {
              marcSubfields.push({
                tagCode: currentMarcTag.code,
                tagDesc: currentMarcTag.description,
                code: subMatch[1].trim(),
                description: subMatch[2].trim(),
              });
            }
          }
        } else if (type === "DDC") {
          if (line.startsWith("###")) {
            // It's a 100-division header
            inEasyHeader = true;
            if (difficulty === "Easy") {
              const match = line.match(/###\s*([0-9]+)\s*—\s*(.+)/);
              if (match) {
                items.push({
                  code: match[1].trim(),
                  description: match[2].trim(),
                });
              }
            }
          } else if (line.startsWith("##") && !line.startsWith("###")) {
            inEasyHeader = false;
          }
        } else if (type === "LCC") {
          if (line.startsWith("##") && !line.startsWith("###")) {
            inEasyHeader = true;
            if (difficulty === "Easy") {
              const match = line.match(/##\s*([A-Z]+)\s*—\s*(.+)/);
              if (match) {
                items.push({
                  code: match[1].trim(),
                  description: match[2].trim(),
                });
              }
            }
          } else if (line.startsWith("#")) {
            inEasyHeader = false;
          }
        }

        // If hard mode, parse everything from the markdown tables
        if (
          difficulty === "Hard" &&
          line.startsWith("|") &&
          !line.includes("---") &&
          !line.toLowerCase().includes("description")
        ) {
          const parts = line.split("|").map((p) => p.trim());
          if (parts.length >= 3) {
            const code = parts[1];
            const description = parts[2];
            if (
              code &&
              description &&
              !description.toLowerCase().includes("no longer used") &&
              !description.toLowerCase().includes("unassigned")
            ) {
              items.push({ code, description });
            }
          }
        }
      }

      const generatedQuestions: Question[] = [];

      if (type === "MARC") {
        if (marcTags.length < 4) {
          setParseError(
            `Not enough MARC tags in ${type}.txt to generate questions.`,
          );
          return;
        }

        // Generate MARC questions
        for (let i = 0; i < count; i++) {
          let qType: "Tags" | "Subfields" = "Tags";
          if (difficulty === "Both") {
            qType = Math.random() > 0.5 ? "Tags" : "Subfields";
          } else if (difficulty === "Subfields") {
            qType = "Subfields";
          }

          // If Subfields mode is chosen but there are no subfields at all, fallback to Tags
          if (qType === "Subfields" && marcSubfields.length === 0) {
            qType = "Tags";
          }

          let stem = "";
          let correctText = "";
          let explanation = "";
          const wrongOptions: string[] = [];

          if (qType === "Tags") {
            const isAskCode = Math.random() > 0.5;
            const target =
              marcTags[Math.floor(Math.random() * marcTags.length)];

            if (isAskCode) {
              stem = `Which MARC tag is used for "${target.description}"?`;
              correctText = target.code;
              explanation = `MARC tag ${target.code} represents ${target.description}.`;
              const wrongItems = shuffleArray(
                marcTags.filter((t) => t.code !== target.code),
              ).slice(0, 3);
              wrongOptions.push(...wrongItems.map((w) => w.code));
            } else {
              stem = `What does MARC tag "${target.code}" represent?`;
              correctText = target.description;
              explanation = `MARC tag ${target.code} represents ${target.description}.`;
              const wrongItems = shuffleArray(
                marcTags.filter((t) => t.code !== target.code),
              ).slice(0, 3);
              wrongOptions.push(...wrongItems.map((w) => w.description));
            }
          } else {
            // Subfields mode
            const target =
              marcSubfields[Math.floor(Math.random() * marcSubfields.length)];
            const isAskCode = Math.random() > 0.5;

            if (isAskCode) {
              stem = `Under MARC tag ${target.tagCode} (${target.tagDesc}), which subfield code is used for "${target.description}"?`;
              correctText = target.code;
              explanation = `Under MARC tag ${target.tagCode}, the subfield code for "${target.description}" is ${target.code}.`;

              let others = marcSubfields.filter(
                (s) => s.tagCode === target.tagCode && s.code !== target.code,
              );
              if (others.length < 3) {
                const extras = marcSubfields.filter(
                  (s) => s.tagCode !== target.tagCode && s.code !== target.code,
                );
                others = others.concat(shuffleArray(extras));
              }
              const wrongItems = shuffleArray(others).slice(0, 3);
              // Ensure uniqueness in options
              const uniqueWrongs = Array.from(
                new Set(wrongItems.map((w) => w.code)),
              );
              while (uniqueWrongs.length < 3) {
                const extras = shuffleArray(
                  marcSubfields.filter(
                    (s) =>
                      s.code !== target.code && !uniqueWrongs.includes(s.code),
                  ),
                );
                if (extras.length > 0) uniqueWrongs.push(extras[0].code);
                else break; // Fallback safety
              }
              wrongOptions.push(...uniqueWrongs.slice(0, 3));
            } else {
              stem = `Under MARC tag ${target.tagCode} (${target.tagDesc}), what does subfield code "${target.code}" represent?`;
              correctText = target.description;
              explanation = `Under MARC tag ${target.tagCode}, subfield code ${target.code} represents "${target.description}".`;

              let others = marcSubfields.filter(
                (s) =>
                  s.tagCode === target.tagCode &&
                  s.description !== target.description,
              );
              if (others.length < 3) {
                const extras = marcSubfields.filter(
                  (s) =>
                    s.tagCode !== target.tagCode &&
                    s.description !== target.description,
                );
                others = others.concat(shuffleArray(extras));
              }
              const wrongItems = shuffleArray(others).slice(0, 3);
              // Ensure uniqueness in options
              const uniqueWrongs = Array.from(
                new Set(wrongItems.map((w) => w.description)),
              );
              while (uniqueWrongs.length < 3) {
                const extras = shuffleArray(
                  marcSubfields.filter(
                    (s) =>
                      s.description !== target.description &&
                      !uniqueWrongs.includes(s.description),
                  ),
                );
                if (extras.length > 0) uniqueWrongs.push(extras[0].description);
                else break; // Fallback safety
              }
              wrongOptions.push(...uniqueWrongs.slice(0, 3));
            }
          }

          while (wrongOptions.length < 3) {
            wrongOptions.push(`Distractor ${wrongOptions.length + 1}`);
          }

          const options: Option[] = [
            { letter: "A", text: correctText, correct: true },
          ];
          wrongOptions.slice(0, 3).forEach((wText, idx) => {
            options.push({
              letter: String.fromCharCode(66 + idx),
              text: wText,
              correct: false,
            });
          });

          const shuffledOptions = shuffleArray(options).map((opt, idx) => ({
            ...opt,
            letter: String.fromCharCode(65 + idx),
          }));

          generatedQuestions.push({
            number: i + 1,
            stem,
            options: shuffledOptions,
            explanation,
          });
        }
      } else {
        if (items.length < 4) {
          setParseError(
            `Not enough items in ${type}.txt to generate questions.`,
          );
          return;
        }

        // Shuffle items to select questions for DDC/LCC
        const shuffledItems = shuffleArray(items);
        const limit = Math.min(count, shuffledItems.length);

        for (let i = 0; i < limit; i++) {
          const item = shuffledItems[i];
          const isAskCode = Math.random() > 0.5;

          let stem = "";
          let correctText = "";

          if (isAskCode) {
            stem = `What is the ${type} subclass for "${item.description}"?`;
            correctText = item.code;
          } else {
            stem = `What subject does the ${type} subclass "${item.code}" represent?`;
            correctText = item.description;
          }

          const options: Option[] = [
            { letter: "A", text: correctText, correct: true },
          ];

          // Pick 3 random wrong options
          const wrongItems = shuffleArray(
            items.filter((x) => x.code !== item.code),
          ).slice(0, 3);
          wrongItems.forEach((w, idx) => {
            options.push({
              letter: String.fromCharCode(66 + idx), // B, C, D
              text: isAskCode ? w.code : w.description,
              correct: false,
            });
          });

          // Shuffle options
          const shuffledOptions = shuffleArray(options).map((opt, idx) => ({
            ...opt,
            letter: String.fromCharCode(65 + idx), // A, B, C, D
          }));

          generatedQuestions.push({
            number: i + 1,
            stem,
            options: shuffledOptions,
            explanation: `The ${type} classification for "${item.description}" is ${item.code}.`,
          });
        }
      }

      setQuestions(generatedQuestions);
      setExamCode(`${type} ${difficulty} Quiz`);
      setFileName(filename);
      setSessionType("classification");

      // Setup immediately and skip configure phase
      setMode("immediate");
      setShowClassifications(false);
      setClassificationType(null);
      setCurrent(0);
      setAnswers({});
      setRevealed({});
      setPendingExam(null);
      setSaved(false);
      setPhase("exam");
      startTimer();
    } catch (err) {
      setParseError("Error fetching classification data: " + String(err));
    }
  }

  // ── computed
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((q, i) => {
    const c = answers[i];
    return c && q.options.find((o) => o.letter === c)?.correct;
  }).length;
  const scorePercent =
    questions.length > 0
      ? Math.round((correctCount / questions.length) * 100)
      : 0;
  const wrongItems: WrongItem[] = questions
    .map((q, i) => {
      const chosen = answers[i];
      const chosenOpt = q.options.find((o) => o.letter === chosen);
      const correctOpt = q.options.find((o) => o.correct);
      if (chosen && q.options.find((o) => o.letter === chosen)?.correct)
        return null;
      return {
        number: q.number,
        stem: q.stem,
        chosen,
        chosenText: chosenOpt?.text,
        correctLetter: correctOpt?.letter || "",
        correctText: correctOpt?.text || "",
        explanation: q.explanation,
      };
    })
    .filter(Boolean) as WrongItem[];

  const q = questions[current];
  const chosenLetter = answers[current];
  const isRevealed =
    mode === "immediate" ? !!revealed[current] : phase === "review";
  const timedOut = elapsed >= examDuration;

  // LLE TOS weighting logic
  const allSubjects = loadSubjects();

  const matchedSubject = allSubjects.find((s) =>
    examCode.toUpperCase().startsWith(s.short),
  );
  const weightedContribution =
    matchedSubject && matchedSubject.weight
      ? (scorePercent / 100) * matchedSubject.weight
      : null;

  // ── tab bar
  const tabBar = (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid var(--cream-border)",
        padding: "0 24px",
        overflowX: "auto",
        flexShrink: 0,
      }}
    >
      {(
        ["exam", "history-exams", "history-quizzes", "p2p-sessions"] as const
      ).map((t) => (
        <button
          key={t}
          onClick={() => setView(t)}
          className={
            t === "p2p-sessions"
              ? `p2p-tab-animated ${view === t ? "active" : ""}`
              : ""
          }
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "calc(13px * var(--scale, 1))",
            padding: "10px 14px",
            background: "none",
            border: "none",
            borderBottom:
              view === t ? "2px solid var(--ink)" : "2px solid transparent",
            color: view === t ? "var(--ink)" : "var(--ink-faint)",
            cursor: "pointer",
            fontWeight: view === t ? 500 : 400,
            textTransform: "capitalize",
            whiteSpace: "nowrap",
          }}
        >
          {t === "history-exams"
            ? "Previous Exams"
            : t === "history-quizzes"
              ? "Previous Quizzes"
              : t === "p2p-sessions"
                ? "P2P Sessions"
                : "Exam"}
        </button>
      ))}
    </div>
  );

  // ── upload error modal (global to component for "load" phase logic which handles file selection)
  const uploadErrorModal = showUploadErrorModal && (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "24px",
      }}
    >
      <div
        style={{
          background: "var(--cream)",
          border: "1px solid var(--cream-border)",
          borderRadius: "var(--radius)",
          padding: "24px",
          width: "100%",
          maxWidth: 320,
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <h3
          style={{
            margin: "0 0 8px 0",
            fontSize: "calc(16px * var(--scale, 1))",
            fontWeight: 600,
            color: "#8B3A3A",
          }}
        >
          Upload Error
        </h3>
        <p
          style={{
            margin: "0 0 20px 0",
            fontSize: "calc(13px * var(--scale, 1))",
            color: "var(--ink-muted)",
            lineHeight: 1.4,
          }}
        >
          {showUploadErrorModal}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => setShowUploadErrorModal(null)}
            style={{
              padding: "8px 16px",
              background: "var(--cream-dark)",
              border: "1px solid var(--cream-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--ink)",
              fontSize: "calc(13px * var(--scale, 1))",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );

  // ── render wrapper
  const renderWithTabBar = (
    content: React.ReactNode,
    showTabBar: boolean = true,
  ) => (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {showTabBar && tabBar}
      {content}
    </div>
  );

  // ── render: shelving
  if (view === "shelving" && shelvingItems) {
    return renderWithTabBar(
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "24px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection:
              "column" /* Changed from row to column to stack them */,
            alignItems:
              "flex-start" /* Changed from center to align button to the left */,
            marginBottom: 24,
            gap: 12 /* This controls the vertical spacing between button and text */,
          }}
        >
          <button
            onClick={() => {
              setView("exam");
              setShelvingItems(null);
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--ink-muted)",
              fontSize: "calc(13px * var(--scale, 1))",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: 0,
            }}
          >
            ← Back
          </button>
          <div>
            <div
              style={{
                fontSize: "calc(20px * var(--scale, 1))",
                fontFamily: "var(--font-display)",
                color: "var(--ink)",
              }}
            >
              Shelving Practice
            </div>
            <div
              style={{
                fontSize: "calc(13px * var(--scale, 1))",
                color: "var(--ink-muted)",
              }}
            >
              {shelvingType} - Arrange the sequence
            </div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <ShelvingInteractive
            key={`${shelvingType}-${shelvingItems.original.join(",")}`}
            items={shelvingItems.shuffled}
            originalItems={shelvingItems.original}
            showCorrectAnswerOnFail={true}
            onConfirm={(correct) => {
              // Practice mode only, no score logging required
            }}
            onRetry={() => {
              const seedIndex = Math.floor(
                Math.random() * shelvingItems.original.length,
              );
              const seed = shelvingItems.original[seedIndex];
              const selected = generateVariations(
                seed,
                shelvingCount,
                shelvingType as "DDC" | "LCC",
              );
              setShelvingItems({
                original: selected,
                shuffled: shuffleArray(selected),
              });
            }}
          />
        </div>
      </div>,
    );
  }

  // ── render: history
  if (view === "history-exams" || view === "history-quizzes")
    return renderWithTabBar(
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PreviousExams
          filterType={view === "history-exams" ? "exam" : "quiz"}
        />
      </div>,
    );

  if (view === "p2p-sessions" && !(sessionType === "p2p" && phase !== "load")) {
    const p2pExams = loadSavedExams().filter((e) => e.sessionType === "p2p");

    // Group by subject and calculate GWA based on POST exams
    const allSubjects = loadSubjects();
    let totalPostScore = 0;
    let postCount = 0;
    const p2pWeaknesses: {
      short: string;
      name: string;
      preScore: number | null;
      postScore: number | null;
    }[] = allSubjects.map((subj) => ({
      short: subj.short,
      name: subj.name,
      preScore: null,
      postScore: null,
    }));

    p2pExams.forEach((exam) => {
      const parts = exam.examCode.split("_");
      if (parts.length >= 2) {
        const short = parts[0]; // e.g. LOM
        const type = parts[1]; // PRE or POST

        const target = p2pWeaknesses.find((w) => w.short === short);
        if (target) {
          if (type === "PRE") {
            // Using most recent, assuming exams array is sorted newest first (which appendSavedExam does)
            if (target.preScore === null) target.preScore = exam.score;
          }
          if (type === "POST") {
            if (target.postScore === null) target.postScore = exam.score;
          }
        }
      }
    });

    p2pWeaknesses.forEach((w) => {
      if (w.postScore !== null) {
        totalPostScore += w.postScore;
        postCount++;
      }
    });

    const gwa = postCount > 0 ? Math.round(totalPostScore / postCount) : null;
    const focusSubjects = p2pWeaknesses.filter(
      (w) =>
        w.postScore !== null && w.preScore !== null && w.postScore < w.preScore,
    );

    return renderWithTabBar(
      <>
        <div
          style={{
            padding: "24px",
            maxWidth: 560,
            margin: "0 auto",
            width: "100%",
            flex: 1,
            overflowY: "auto",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "calc(20px * var(--scale, 1))",
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              Practice
            </div>
            <div
              style={{
                fontSize: "calc(13px * var(--scale, 1))",
                color: "var(--ink-muted)",
              }}
            >
              Select a subject to begin.
            </div>
          </div>

          <button
            onClick={() => {
              setView("exam");
              setSubjectSelector({ show: false, count: 0 });
              setShowClassifications(false);
              setClassificationType(null);
              setShowCustom(false);
              setParseError("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "var(--ink-muted)",
              fontSize: "calc(13px * var(--scale, 1))",
              cursor: "pointer",
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ← Back to modes
          </button>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            {P2P_SESSIONS.map((sess) => {
              const isCompleted = p2pExams.some(
                (e) => e.examCode === sess.code,
              );
              const isLocked = sess.password === "locked";
              const isDisabled = isCompleted || isLocked;
              return (
                <button
                  key={sess.id}
                  onClick={() => {
                    if (isDisabled) return;
                    setShowP2pModal(sess);
                    setP2pPassword("");
                    setP2pError("");
                  }}
                  style={{
                    background: isDisabled
                      ? "var(--cream-dark)"
                      : "var(--cream)",
                    border: "1px solid var(--cream-border)",
                    borderRadius: "12px",
                    padding: "16px",
                    textAlign: "left",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                    opacity: isDisabled ? 0.6 : 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: "calc(15px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                      textDecoration: isCompleted ? "line-through" : "none",
                    }}
                  >
                    {sess.subject}
                  </span>
                  <span
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
                      color: "var(--ink-muted)",
                      lineHeight: 1.4,
                    }}
                  >
                    {sess.name}{" "}
                    {isCompleted ? "(Completed)" : isLocked ? "(Locked)" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {/* P2P Statistics */}
          <div
            style={{
              background: "var(--cream)",
              border: "1px solid var(--cream-border)",
              borderRadius: "var(--radius)",
              padding: "16px",
              marginTop: "24px",
            }}
          >
            <div
              style={{
                fontSize: "calc(15px * var(--scale, 1))",
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: "12px",
              }}
            >
              P2P Session Statistics
            </div>

            {p2pExams.length === 0 ? (
              <div
                style={{
                  fontSize: "calc(13px * var(--scale, 1))",
                  color: "var(--ink-muted)",
                  textAlign: "center",
                  padding: "16px 0",
                }}
              >
                Complete P2P Sessions to see your statistics here.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <div>
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
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      Post-Exam GWA
                    </span>
                    <span
                      style={{
                        fontSize: "calc(16px * var(--scale, 1))",
                        fontFamily: "var(--font-display)",
                        color:
                          gwa !== null && gwa >= 75
                            ? "var(--green)"
                            : "var(--accent)",
                      }}
                    >
                      {gwa !== null ? `${gwa}%` : "—"}
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      background: "var(--cream-dark)",
                      borderRadius: 4,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        left: "75%",
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: "var(--accent)",
                        opacity: 0.5,
                        zIndex: 2,
                      }}
                    />
                    {gwa !== null && (
                      <div
                        style={{
                          height: "100%",
                          width: `${gwa}%`,
                          background:
                            gwa < 75 ? "var(--accent)" : "var(--green)",
                          borderRadius: 4,
                          transition: "width 0.5s ease",
                          zIndex: 1,
                        }}
                      />
                    )}
                  </div>
                </div>

                <div
                  style={{
                    background:
                      focusSubjects.length > 0
                        ? "var(--red-bg)"
                        : "var(--green-bg)",
                    padding: 12,
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "calc(11px * var(--scale, 1))",
                      color:
                        focusSubjects.length > 0
                          ? "var(--red)"
                          : "var(--green)",
                      fontWeight: 500,
                      marginBottom: 6,
                    }}
                  >
                    Focus Area
                  </div>
                  <div
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
                      color: "var(--ink)",
                      lineHeight: 1.4,
                    }}
                  >
                    {focusSubjects.length > 0
                      ? `Your post-exam score is lower than your pre-exam score in: ${focusSubjects.map((s) => s.short).join(", ")}. Consider dedicating more time to these subjects.`
                      : p2pWeaknesses.some(
                            (w) => w.preScore !== null && w.postScore !== null,
                          )
                        ? "Great job! Your post-exam scores show improvement or consistency across all subjects."
                        : "Complete both Pre and Post exams for a subject to see improvement tracking."}
                  </div>
                </div>

                {/* Score comparisons */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink-muted)",
                      marginBottom: "4px",
                    }}
                  >
                    Subject Breakdown
                  </div>
                  {p2pWeaknesses.map((w) => {
                    const hasPre = w.preScore !== null;
                    const hasPost = w.postScore !== null;
                    if (!hasPre && !hasPost) return null;

                    return (
                      <div
                        key={w.short}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "var(--cream-dark)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--cream-border)",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "calc(13px * var(--scale, 1))",
                            fontWeight: 500,
                            color: "var(--ink)",
                          }}
                        >
                          {w.short}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            fontSize: "calc(12px * var(--scale, 1))",
                          }}
                        >
                          <div>
                            <span style={{ color: "var(--ink-faint)" }}>
                              Pre:{" "}
                            </span>
                            <span
                              style={{ color: "var(--ink)", fontWeight: 500 }}
                            >
                              {hasPre ? `${w.preScore}%` : "—"}
                            </span>
                          </div>
                          <div>
                            {hasPost ? (
                              <>
                                <span style={{ color: "var(--ink-faint)" }}>
                                  Post:{" "}
                                </span>
                                <span
                                  style={{
                                    color: "var(--ink)",
                                    fontWeight: 500,
                                  }}
                                >
                                  {w.postScore}%
                                </span>
                              </>
                            ) : (
                              <span
                                style={{
                                  fontSize: "calc(10px * var(--scale, 1))",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "var(--accent-bg)",
                                  color: "var(--accent)",
                                  fontWeight: 500,
                                }}
                              >
                                Waiting for Post-Exam
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {showP2pModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding:
                "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
            }}
          >
            <div
              style={{
                background: "var(--cream)",
                padding: "24px",
                borderRadius: "20px",
                maxWidth: "320px",
                width: "90%",
                border: "1px solid var(--cream-border)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: "calc(16px * var(--scale, 1))",
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                {showP2pModal.name}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "calc(14px * var(--scale, 1))",
                  color: "var(--ink-muted)",
                }}
              >
                This session requires a password.
              </p>
              <input
                type="text"
                placeholder="Password"
                value={p2pPassword}
                onChange={(e) => {
                  setP2pPassword(e.target.value);
                  setP2pError("");
                }}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid var(--cream-border)",
                  fontSize: "calc(16px * var(--scale, 1))",
                  width: "100%",
                  boxSizing: "border-box",
                  background: "var(--cream-dark)",
                  color: "var(--ink)",
                }}
              />
              {p2pError && (
                <div
                  style={{
                    color: "#8B3A3A",
                    fontSize: "calc(12px * var(--scale, 1))",
                    background: "#F5E8E8",
                    padding: "8px 12px",
                    borderRadius: "8px",
                  }}
                >
                  {p2pError}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                  marginTop: "8px",
                }}
              >
                <button
                  onClick={() => {
                    setShowP2pModal(null);
                    setP2pPassword("");
                    setP2pError("");
                  }}
                  style={{
                    padding: "10px 16px",
                    background: "transparent",
                    color: "var(--ink-muted)",
                    border: "none",
                    borderRadius: "12px",
                    cursor: "pointer",
                    fontSize: "calc(14px * var(--scale, 1))",
                    fontWeight: 500,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (p2pPassword === showP2pModal.password) {
                      startP2pExam(showP2pModal);
                    } else {
                      setP2pError("Incorrect password.");
                    }
                  }}
                  style={{
                    padding: "10px 16px",
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "calc(13px * var(--scale, 1))",
                    fontFamily: "var(--font-body)",
                    fontWeight: 500,
                  }}
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        )}
      </>,
    );
  }
  const percentage: number = ((shelvingCount - 1) / (10 - 1)) * 100;

  // ── render: load
  if (phase === "load" && view === "exam")
    return renderWithTabBar(
      <>
        {uploadErrorModal}
        <div
          style={{
            padding: "24px",
            maxWidth: 560,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "calc(20px * var(--scale, 1))",
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              Practice
            </div>
            <div
              style={{
                fontSize: "calc(13px * var(--scale, 1))",
                color: "var(--ink-muted)",
              }}
            >
              {subjectSelector.show
                ? "Select a subject to begin."
                : "Choose a mode to begin your session."}
            </div>
          </div>

          {parseError && (
            <div
              style={{
                fontSize: "calc(12px * var(--scale, 1))",
                color: "#8B3A3A",
                background: "#F5E8E8",
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                marginBottom: 16,
              }}
            >
              {parseError}
            </div>
          )}

          {subjectSelector.show ? (
            <div>
              <button
                onClick={() => {
                  setSubjectSelector({ show: false, count: 0 });
                  setParseError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-muted)",
                  fontSize: "calc(13px * var(--scale, 1))",
                  cursor: "pointer",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ← Back to modes
              </button>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                }}
              >
                {allSubjects.map((subj) => (
                  <button
                    key={subj.short}
                    onClick={() =>
                      fetchBuiltIn(
                        subj.short,
                        subjectSelector.count,
                        subjectSelector.count === 15,
                      )
                    }
                    style={{
                      padding: "16px 20px",
                      background: "var(--cream)",
                      border: "1px solid var(--cream-border)",
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font-body)",
                      transition: "background 0.15s, border 0.15s",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "calc(15px * var(--scale, 1))",
                        fontWeight: 500,
                        color: "var(--ink)",
                        marginBottom: 4,
                      }}
                    >
                      {subj.short}
                    </div>
                    <div
                      style={{
                        fontSize: "calc(12px * var(--scale, 1))",
                        color: "var(--ink-muted)",
                        lineHeight: 1.4,
                      }}
                    >
                      {subj.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : showClassifications ? (
            <div>
              <button
                onClick={() => {
                  if (classificationType === "MARC") {
                    setClassificationType(null);
                    setShowClassifications(false);
                  } else if (classificationType) {
                    setClassificationType(null);
                  } else {
                    setShowClassifications(false);
                  }
                  setParseError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-muted)",
                  fontSize: "calc(13px * var(--scale, 1))",
                  cursor: "pointer",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ←{" "}
                {classificationType && classificationType !== "MARC"
                  ? "Back to Classifications"
                  : "Back to modes"}
              </button>

              {!classificationType ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <button
                    onClick={() => setClassificationType("DDC")}
                    style={{
                      padding: "16px 20px",
                      background: "var(--cream)",
                      border: "1px solid var(--cream-border)",
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font-body)",
                      transition: "background 0.15s, border 0.15s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "calc(15px * var(--scale, 1))",
                          fontWeight: 500,
                          color: "var(--ink)",
                          marginBottom: 4,
                        }}
                      >
                        Dewey Decimal Classification
                      </div>
                      <div
                        style={{
                          fontSize: "calc(12px * var(--scale, 1))",
                          color: "var(--ink-muted)",
                          lineHeight: 1.4,
                        }}
                      >
                        Practice DDC numbers and their corresponding subjects.
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "calc(18px * var(--scale, 1))",
                        color: "var(--ink-faint)",
                      }}
                    >
                      →
                    </div>
                  </button>

                  <button
                    onClick={() => setClassificationType("LCC")}
                    style={{
                      padding: "16px 20px",
                      background: "var(--cream)",
                      border: "1px solid var(--cream-border)",
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font-body)",
                      transition: "background 0.15s, border 0.15s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "calc(15px * var(--scale, 1))",
                          fontWeight: 500,
                          color: "var(--ink)",
                          marginBottom: 4,
                        }}
                      >
                        Library of Congress Classification
                      </div>
                      <div
                        style={{
                          fontSize: "calc(12px * var(--scale, 1))",
                          color: "var(--ink-muted)",
                          lineHeight: 1.4,
                        }}
                      >
                        Practice LCC subclasses and their corresponding
                        subjects.
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "calc(18px * var(--scale, 1))",
                        color: "var(--ink-faint)",
                      }}
                    >
                      →
                    </div>
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        fontSize: "calc(13px * var(--scale, 1))",
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      <span>Number of Questions</span>
                      <span style={{ color: "var(--accent)" }}>
                        {classificationCount}
                      </span>
                    </div>
                    <CustomSlider
                      min={1}
                      max={50}
                      value={classificationCount}
                      onChange={setClassificationCount}
                    />
                  </div>

                  <div
                    style={{
                      fontSize: "calc(13px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 12,
                    }}
                  >
                    Select{" "}
                    {classificationType === "MARC" ? "Mode" : "Difficulty"}
                  </div>
                  {classificationType === "MARC" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <button
                        onClick={() =>
                          proceedAction(() =>
                            fetchClassification(
                              classificationType,
                              "Tags",
                              classificationCount,
                            ),
                          )
                        }
                        style={{
                          padding: "16px 20px",
                          background: "var(--cream)",
                          border: "1px solid var(--cream-border)",
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "var(--font-body)",
                          transition: "background 0.15s, border 0.15s",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "calc(15px * var(--scale, 1))",
                            fontWeight: 500,
                            color: "var(--ink)",
                            marginBottom: 4,
                          }}
                        >
                          MARC Tags
                        </div>
                        <div
                          style={{
                            fontSize: "calc(12px * var(--scale, 1))",
                            color: "var(--ink-muted)",
                            lineHeight: 1.4,
                          }}
                        >
                          Practice identifying tags and their meanings.
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          proceedAction(() =>
                            fetchClassification(
                              classificationType,
                              "Subfields",
                              classificationCount,
                            ),
                          )
                        }
                        style={{
                          padding: "16px 20px",
                          background: "var(--cream)",
                          border: "1px solid var(--cream-border)",
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "var(--font-body)",
                          transition: "background 0.15s, border 0.15s",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "calc(15px * var(--scale, 1))",
                            fontWeight: 500,
                            color: "var(--ink)",
                            marginBottom: 4,
                          }}
                        >
                          Subfields
                        </div>
                        <div
                          style={{
                            fontSize: "calc(12px * var(--scale, 1))",
                            color: "var(--ink-muted)",
                            lineHeight: 1.4,
                          }}
                        >
                          Practice identifying subfields given a tag.
                        </div>
                      </button>
                      <button
                        onClick={() =>
                          proceedAction(() =>
                            fetchClassification(
                              classificationType,
                              "Both",
                              classificationCount,
                            ),
                          )
                        }
                        style={{
                          padding: "16px 20px",
                          background: "var(--cream)",
                          border: "1px solid var(--cream-border)",
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "var(--font-body)",
                          transition: "background 0.15s, border 0.15s",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "calc(15px * var(--scale, 1))",
                            fontWeight: 500,
                            color: "var(--ink)",
                            marginBottom: 4,
                          }}
                        >
                          Both
                        </div>
                        <div
                          style={{
                            fontSize: "calc(12px * var(--scale, 1))",
                            color: "var(--ink-muted)",
                            lineHeight: 1.4,
                          }}
                        >
                          A mix of tags and subfield questions.
                        </div>
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 12,
                      }}
                    >
                      <button
                        onClick={() =>
                          proceedAction(() =>
                            fetchClassification(
                              classificationType,
                              "Easy",
                              classificationCount,
                            ),
                          )
                        }
                        style={{
                          padding: "16px 20px",
                          background: "var(--cream)",
                          border: "1px solid var(--cream-border)",
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "var(--font-body)",
                          transition: "background 0.15s, border 0.15s",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "calc(15px * var(--scale, 1))",
                            fontWeight: 500,
                            color: "var(--ink)",
                            marginBottom: 4,
                          }}
                        >
                          Easy
                        </div>
                        <div
                          style={{
                            fontSize: "calc(12px * var(--scale, 1))",
                            color: "var(--ink-muted)",
                            lineHeight: 1.4,
                          }}
                        >
                          {classificationType === "DDC"
                            ? "100 Divisions"
                            : "21 Main Classes/Letters"}
                        </div>
                      </button>

                      <button
                        onClick={() =>
                          proceedAction(() =>
                            fetchClassification(
                              classificationType,
                              "Hard",
                              classificationCount,
                            ),
                          )
                        }
                        style={{
                          padding: "16px 20px",
                          background: "var(--cream)",
                          border: "1px solid var(--cream-border)",
                          borderRadius: "var(--radius)",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "var(--font-body)",
                          transition: "background 0.15s, border 0.15s",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "calc(15px * var(--scale, 1))",
                            fontWeight: 500,
                            color: "var(--ink)",
                            marginBottom: 4,
                          }}
                        >
                          Hard
                        </div>
                        <div
                          style={{
                            fontSize: "calc(12px * var(--scale, 1))",
                            color: "var(--ink-muted)",
                            lineHeight: 1.4,
                          }}
                        >
                          {classificationType === "DDC"
                            ? "1000 Divisions"
                            : "250 Subclasses"}
                        </div>
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : showShelving ? (
            <div>
              <button
                onClick={() => setShowShelving(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-muted)",
                  fontSize: "calc(13px * var(--scale, 1))",
                  cursor: "pointer",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ← Back to modes
              </button>

              {!shelvingType ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  <button
                    onClick={() => setShelvingType("DDC")}
                    style={{
                      padding: "16px 20px",
                      background: "var(--cream)",
                      border: "1px solid var(--cream-border)",
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontFamily: "var(--font-body)",
                      transition: "background 0.15s, border 0.15s",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "calc(15px * var(--scale, 1))",
                          fontWeight: 500,
                          color: "var(--ink)",
                          marginBottom: 4,
                        }}
                      >
                        Dewey Decimal Classification
                      </div>
                      <div
                        style={{
                          fontSize: "calc(12px * var(--scale, 1))",
                          color: "var(--ink-muted)",
                          textAlign: "left",
                        }}
                      >
                        Practice sorting DDC call numbers.
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "calc(18px * var(--scale, 1))",
                        color: "var(--ink-faint)",
                      }}
                    >
                      →
                    </div>
                  </button>

                  <button
                    onClick={() => setShelvingType("LCC")}
                    style={{
                      padding: "16px 20px",
                      background: "var(--cream)",
                      border: "1px solid var(--cream-border)",
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontFamily: "var(--font-body)",
                      transition: "background 0.15s, border 0.15s",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "calc(15px * var(--scale, 1))",
                          fontWeight: 500,
                          color: "var(--ink)",
                          marginBottom: 4,
                        }}
                      >
                        Library of Congress Classification
                      </div>
                      <div
                        style={{
                          fontSize: "calc(12px * var(--scale, 1))",
                          color: "var(--ink-muted)",
                          textAlign: "left",
                        }}
                      >
                        Practice sorting LCC call numbers.
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "calc(18px * var(--scale, 1))",
                        color: "var(--ink-faint)",
                      }}
                    >
                      →
                    </div>
                  </button>
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 16 }}
                >
                  <div
                    style={{
                      background: "var(--cream)",
                      border: "1px solid var(--cream-border)",
                      borderRadius: "var(--radius)",
                      padding: "16px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                        fontSize: "calc(13px * var(--scale, 1))",
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      <span>Number of items to sort</span>
                      <span style={{ color: "var(--accent)" }}>
                        {shelvingCount}
                      </span>
                    </div>
                    <CustomSlider
                      min={1}
                      max={10}
                      value={shelvingCount}
                      onChange={setShelvingCount}
                    />
                  </div>

                  <button
                    onClick={() =>
                      proceedAction(async () => {
                        try {
                          const res = await fetch(
                            `${shelvingType}_Shelving.txt`,
                          );
                          const text = await res.text();
                          const lines = text.split("\n").filter(Boolean);
                          if (lines.length === 0) {
                            setParseError(
                              `No items in ${shelvingType}_Shelving.txt`,
                            );
                            return;
                          }
                          const seedIndex = Math.floor(
                            Math.random() * lines.length,
                          );
                          const seed = lines[seedIndex];
                          const selected = generateVariations(
                            seed,
                            shelvingCount,
                            shelvingType as "DDC" | "LCC",
                          );

                          setShelvingItems({
                            original: selected,
                            shuffled: shuffleArray(selected),
                          });
                          setView("shelving");
                        } catch (e) {
                          setParseError(
                            `Failed to load ${shelvingType} shelving data.`,
                          );
                        }
                      })
                    }
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      fontSize: "calc(13px * var(--scale, 1))",
                      fontWeight: 500,
                      background: "var(--accent)",
                      color: "white",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Start Practice
                  </button>
                </div>
              )}
            </div>
          ) : !showCustom ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={() =>
                  proceedAction(() =>
                    setSubjectSelector({ show: true, count: 15 }),
                  )
                }
                style={{
                  padding: "16px 20px",
                  background: "var(--cream)",
                  border: "1px solid var(--cream-border)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-body)",
                  transition: "background 0.15s, border 0.15s",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "calc(15px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 4,
                    }}
                  >
                    Quiz
                  </div>
                  <div
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
                      color: "var(--ink-muted)",
                    }}
                  >
                    15 randomized items from your chosen subject.
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "calc(18px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                  }}
                >
                  →
                </div>
              </button>

              <button
                onClick={() =>
                  proceedAction(() =>
                    setSubjectSelector({ show: true, count: 100 }),
                  )
                }
                style={{
                  padding: "16px 20px",
                  background: "var(--cream)",
                  border: "1px solid var(--cream-border)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-body)",
                  transition: "background 0.15s, border 0.15s",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "calc(15px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 4,
                    }}
                  >
                    Mock Exam
                  </div>
                  <div
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
                      color: "var(--ink-muted)",
                    }}
                  >
                    100 randomized items to simulate the real thing.
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "calc(18px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                  }}
                >
                  →
                </div>
              </button>

              <div
                style={{
                  height: 1,
                  background: "var(--cream-border)",
                  margin: "12px 0",
                }}
              />

              <button
                onClick={() =>
                  proceedAction(() => {
                    setShowClassifications(true);
                    setParseError("");
                  })
                }
                style={{
                  padding: "16px 20px",
                  background: "var(--cream)",
                  border: "1px solid var(--cream-border)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-body)",
                  transition: "background 0.15s, border 0.15s",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "calc(15px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 4,
                    }}
                  >
                    Classifications
                  </div>
                  <div
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
                      color: "var(--ink-muted)",
                    }}
                  >
                    Practice your knowledge on DDC, LCC.
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "calc(18px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                  }}
                >
                  →
                </div>
              </button>

              <button
                onClick={() =>
                  proceedAction(() => {
                    setShowShelving(true);
                    setShelvingType(null);
                    setParseError("");
                  })
                }
                style={{
                  padding: "16px 20px",
                  background: "var(--cream)",
                  border: "1px solid var(--cream-border)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-body)",
                  transition: "background 0.15s, border 0.15s",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "calc(15px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 4,
                    }}
                  >
                    Shelving Practice
                  </div>
                  <div
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
                      color: "var(--ink-muted)",
                    }}
                  >
                    Practice correct call number sequence shelving.
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "calc(18px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                  }}
                >
                  →
                </div>
              </button>

              <button
                onClick={() =>
                  proceedAction(() => {
                    setShowClassifications(true);
                    setClassificationType("MARC");
                    setParseError("");
                  })
                }
                style={{
                  padding: "16px 20px",
                  background: "var(--cream)",
                  border: "1px solid var(--cream-border)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-body)",
                  transition: "background 0.15s, border 0.15s",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "calc(15px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 4,
                    }}
                  >
                    MARC Practice
                  </div>
                  <div
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
                      color: "var(--ink-muted)",
                    }}
                  >
                    Practice MARC tags and subfields.
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "calc(18px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                  }}
                >
                  →
                </div>
              </button>

              <div
                style={{
                  height: 1,
                  background: "var(--cream-border)",
                  margin: "12px 0",
                }}
              />

              <button
                onClick={() =>
                  proceedAction(() => {
                    setShowCustom(true);
                    setParseError("");
                  })
                }
                style={{
                  padding: "16px 20px",
                  background: "var(--cream-dark)",
                  border: "1px dashed var(--cream-border)",
                  borderRadius: "var(--radius)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-body)",
                  transition: "background 0.15s, border 0.15s",
                }}
              >
                <div style={{ textAlign: "left" }}>
                  <div
                    style={{
                      fontSize: "calc(14px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                      marginBottom: 4,
                    }}
                  >
                    Custom Upload
                  </div>
                  <div
                    style={{
                      fontSize: "calc(12px * var(--scale, 1))",
                      color: "var(--ink-faint)",
                    }}
                  >
                    Load your own .txt file with custom questions.
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "calc(18px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                  }}
                >
                  +
                </div>
              </button>
            </div>
          ) : (
            <div>
              <button
                onClick={() => {
                  setShowCustom(false);
                  setParseError("");
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--ink-muted)",
                  fontSize: "calc(13px * var(--scale, 1))",
                  cursor: "pointer",
                  marginBottom: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ← Back to modes
              </button>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${dragOver ? "var(--accent)" : "var(--cream-border)"}`,
                  borderRadius: "var(--radius)",
                  padding: "36px 24px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver
                    ? "var(--accent-bg)"
                    : "var(--cream-dark)",
                  transition: "all 0.15s",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: "calc(28px * var(--scale, 1))",
                    marginBottom: 10,
                  }}
                >
                  📄
                </div>
                <div
                  style={{
                    fontSize: "calc(14px * var(--scale, 1))",
                    fontWeight: 500,
                    color: "var(--ink)",
                    marginBottom: 4,
                  }}
                >
                  Drop your .txt file here
                </div>
                <div
                  style={{
                    fontSize: "calc(12px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                  }}
                >
                  or click to browse
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={onFileInput}
                  style={{ display: "none" }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <button
                  onClick={() => {
                    navigator.clipboard
                      .writeText(`Please create 100 multiple-choice questions for the subject based on the attached files. Use exactly this format:
First line must be the exam code (e.g. LOM_1).
Then for each question:
Q. [The question text]
O. [Incorrect option]
*O. [Correct option with an asterisk at the start]
O. [Incorrect option]
O. [Incorrect option]
Y: [Explanation for the answer]

Do not use numbers for questions or letters for choices. Always use Q., O., *O., and Y:. Provide no other conversation or text outside of this exact format.`);
                    setCopiedPrompt(true);
                    setTimeout(() => setCopiedPrompt(false), 2000);
                  }}
                  style={{
                    padding: "8px 16px",
                    background: "transparent",
                    border: "1px dashed var(--cream-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--ink-muted)",
                    fontSize: "calc(12px * var(--scale, 1))",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    transition: "all 0.15s",
                  }}
                >
                  {copiedPrompt
                    ? "✓ Prompt Copied!"
                    : "📋 Copy sample AI prompt"}
                </button>
              </div>

              <div
                style={{
                  background: "var(--cream)",
                  border: "1px solid var(--cream-border)",
                  borderRadius: "var(--radius)",
                  padding: "14px 16px",
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    fontSize: "calc(12px * var(--scale, 1))",
                    fontWeight: 500,
                    color: "var(--ink)",
                    marginBottom: 8,
                  }}
                >
                  Expected file format
                </div>
                <pre
                  style={{
                    fontSize: "calc(11px * var(--scale, 1))",
                    color: "var(--ink-muted)",
                    lineHeight: 1.7,
                    fontFamily: "var(--font-mono, monospace)",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >{`LOM_1

Q. A library administration decides to use "Lean Management" principles. What is the absolute primary objective of a Lean strategy in a library's physical processing department?
*O. The relentless identification and total elimination of all forms of "waste"...
O. Firing 50% of the staff...
O. Forcing the staff to work...
O. Outsourcing all cataloging...
Y: Lean management (derived from the Toyota Production System)...`}</pre>
                <div
                  style={{
                    fontSize: "calc(11px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                    marginTop: 10,
                    borderTop: "1px solid var(--cream-border)",
                    paddingTop: 8,
                  }}
                >
                  First line must be the exam code (e.g.{" "}
                  <code
                    style={{
                      background: "var(--cream-dark)",
                      padding: "1px 5px",
                      borderRadius: 3,
                    }}
                  >
                    LOM_1
                  </code>
                  ). Start questions with Q., prefix the correct option with{" "}
                  <code
                    style={{
                      background: "var(--cream-dark)",
                      padding: "1px 5px",
                      borderRadius: 3,
                    }}
                  >
                    *
                  </code>{" "}
                  before O., and prefix explanations with Y:.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* P2P Password Modal */}
        {showP2pModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding:
                "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
            }}
          >
            <div
              style={{
                background: "var(--cream)",
                padding: "24px",
                borderRadius: "20px",
                maxWidth: "320px",
                width: "90%",
                border: "1px solid var(--cream-border)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <h3
                style={{ margin: 0, fontSize: "calc(18px * var(--scale, 1))" }}
              >
                {showP2pModal.name}
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "calc(14px * var(--scale, 1))",
                  color: "var(--ink-muted)",
                }}
              >
                This session requires a password.
              </p>
              <input
                type="text"
                placeholder="Password"
                value={p2pPassword}
                onChange={(e) => {
                  setP2pPassword(e.target.value);
                  setP2pError("");
                }}
                style={{
                  padding: "12px",
                  borderRadius: "12px",
                  border: "1px solid var(--cream-border)",
                  fontSize: "calc(16px * var(--scale, 1))",
                  width: "100%",
                  boxSizing: "border-box",
                  background: "var(--cream-dark)",
                  color: "var(--ink)",
                }}
              />
              {p2pError && (
                <div
                  style={{
                    color: "var(--red)",
                    fontSize: "calc(12px * var(--scale, 1))",
                  }}
                >
                  {p2pError}
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                  marginTop: "8px",
                }}
              >
                <button
                  onClick={() => setShowP2pModal(null)}
                  style={{
                    padding: "10px 16px",
                    background: "transparent",
                    border: "none",
                    color: "var(--ink-faint)",
                    cursor: "pointer",
                    fontSize: "calc(14px * var(--scale, 1))",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (p2pPassword === showP2pModal.password) {
                      startP2pExam(showP2pModal);
                    } else {
                      setP2pError("Incorrect password.");
                    }
                  }}
                  style={{
                    padding: "10px 16px",
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "calc(13px * var(--scale, 1))",
                    fontFamily: "var(--font-body)",
                    fontWeight: 500,
                  }}
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rest Day Modal */}
        {restModalAction && (
          <>
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0, 0, 0, 0.5)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              onClick={() => setRestModalAction(null)}
            >
              <div
                style={{
                  background: "var(--cream)",
                  padding: "24px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--cream-border)",
                  maxWidth: "400px",
                  width: "90%",
                  textAlign: "center",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "calc(20px * var(--scale, 1))",
                    color: "var(--ink)",
                    marginBottom: 16,
                  }}
                >
                  You should be resting today
                  <br />
                  Are you sure you want to proceed?
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    justifyContent: "center",
                  }}
                >
                  <button
                    onClick={() => setRestModalAction(null)}
                    style={{
                      padding: "8px 16px",
                      background: "var(--cream-dark)",
                      border: "1px solid var(--cream-border)",
                      borderRadius: "var(--radius-sm)",
                      color: "var(--ink-muted)",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (restModalAction) restModalAction();
                      setRestModalAction(null);
                    }}
                    style={{
                      padding: "8px 16px",
                      background: "var(--accent)",
                      border: "none",
                      borderRadius: "var(--radius-sm)",
                      color: "white",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Yes, proceed
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </>,
    );

  // tab guard: active p2p session but looking at exam tab
  if (view === "exam" && sessionType === "p2p" && phase !== "load") {
    return renderWithTabBar(
      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <div
          style={{
            fontSize: "calc(16px * var(--scale, 1))",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          Active P2P Session
        </div>
        <div
          style={{
            fontSize: "calc(13px * var(--scale, 1))",
            color: "var(--ink-muted)",
            marginBottom: 20,
          }}
        >
          You currently have an active P2P session running.
        </div>
        <button
          onClick={() => setView("p2p-sessions")}
          style={{
            padding: "10px 20px",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "calc(13px * var(--scale, 1))",
          }}
        >
          Return to P2P Session
        </button>
      </div>,
    );
  }

  // tab guard: active standard exam but looking at p2p tab
  if (view === "p2p-sessions" && sessionType !== "p2p" && phase !== "load") {
    return renderWithTabBar(
      <div style={{ padding: "40px 24px", textAlign: "center" }}>
        <div
          style={{
            fontSize: "calc(16px * var(--scale, 1))",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          Active Exam Session
        </div>
        <div
          style={{
            fontSize: "calc(13px * var(--scale, 1))",
            color: "var(--ink-muted)",
            marginBottom: 20,
          }}
        >
          You currently have an active practice session running.
        </div>
        <button
          onClick={() => setView("exam")}
          style={{
            padding: "10px 20px",
            background: "var(--accent)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: "calc(13px * var(--scale, 1))",
          }}
        >
          Return to Exam
        </button>
      </div>,
    );
  }

  // ── render: configure
  if (phase === "configure")
    return renderWithTabBar(
      <>
        <div
          style={{
            padding: "24px",
            maxWidth: 480,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "calc(20px * var(--scale, 1))",
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              Session setup
            </div>
            <div
              style={{
                fontSize: "calc(13px * var(--scale, 1))",
                color: "var(--ink-muted)",
              }}
            >
              <span style={{ color: "var(--green)", fontWeight: 500 }}>
                {questions.length} questions
              </span>{" "}
              ·{" "}
              <span style={{ color: "var(--accent)", fontWeight: 500 }}>
                {examCode || fileName}
              </span>
            </div>
          </div>

          {sessionType === "p2p" ? (
            <div
              style={{
                padding: "16px",
                background: "var(--red-bg)",
                border: "1px solid var(--red)",
                borderRadius: "var(--radius-sm)",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: "calc(13px * var(--scale, 1))",
                  fontWeight: 600,
                  color: "var(--red)",
                  marginBottom: 8,
                }}
              >
                P2P Session Reminder
              </div>
              <div
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
                  color: "var(--ink)",
                  lineHeight: 1.5,
                }}
              >
                <ul style={{ margin: 0, paddingLeft: "20px" }}>
                  <li>
                    <strong>Time Limit:</strong> Strictly 2 hours per session.
                  </li>
                  <li>
                    <strong>Exam Order:</strong> Complete the Pre exam before
                    the Post exam to properly track your GWA.
                  </li>
                  <li>
                    <strong>Next Steps:</strong> Finish the Post exam before
                    moving to another subject.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginBottom: 10,
                }}
              >
                Feedback mode
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {(
                  [
                    {
                      value: "end",
                      label: "Full exam mode",
                      note: "Answer all questions, see results at the end",
                    },
                    {
                      value: "immediate",
                      label: "Immediate feedback",
                      note: "See correct/wrong right after each answer",
                    },
                  ] as const
                ).map((opt) => (
                  <div
                    key={opt.value}
                    onClick={() => setMode(opt.value)}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "var(--radius-sm)",
                      cursor: "pointer",
                      border: `1px solid ${mode === opt.value ? "var(--accent-light)" : "var(--cream-border)"}`,
                      background:
                        mode === opt.value
                          ? "var(--accent-bg)"
                          : "var(--cream)",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: "50%",
                        flexShrink: 0,
                        border: `2px solid ${mode === opt.value ? "var(--accent)" : "var(--cream-border)"}`,
                        background:
                          mode === opt.value ? "var(--accent)" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {mode === opt.value && (
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "white",
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "calc(13px * var(--scale, 1))",
                          fontWeight: 500,
                          color: "var(--ink)",
                        }}
                      >
                        {opt.label}
                      </div>
                      <div
                        style={{
                          fontSize: "calc(11px * var(--scale, 1))",
                          color: "var(--ink-faint)",
                        }}
                      >
                        {opt.note}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sessionType !== "p2p" && (
            <div
              style={{
                padding: "10px 14px",
                background: "var(--cream-dark)",
                border: "1px solid var(--cream-border)",
                borderRadius: "var(--radius-sm)",
                marginBottom: 20,
                fontSize: "calc(12px * var(--scale, 1))",
                color: "var(--ink-muted)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: "calc(16px * var(--scale, 1))" }}>
                ⏱
              </span>
              Strict 1-hour timer. Exam auto-submits when time runs out.
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={startExam}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: "calc(13px * var(--scale, 1))",
                fontWeight: 500,
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Begin exam
            </button>
            <button
              onClick={reset}
              style={{
                padding: "10px 16px",
                fontSize: "calc(13px * var(--scale, 1))",
                background: "var(--cream-dark)",
                color: "var(--ink-muted)",
                border: "1px solid var(--cream-border)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Back
            </button>
          </div>
        </div>
      </>,
    );

  // ── render: exam
  if (phase === "exam" && q) {
    const isLast = current === questions.length - 1;
    return renderWithTabBar(
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          padding: "20px 24px",
        }}
      >
        {/* top bar */}
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
                  color: "var(--ink-faint)",
                }}
              >
                {examCode} · {mode === "immediate" ? "Immediate" : "Full exam"}
              </span>
              <span
                style={{
                  fontSize: "calc(11px * var(--scale, 1))",
                  color: "var(--ink-muted)",
                }}
              >
                {answeredCount}/{questions.length} answered
              </span>
            </div>
            <TimerDisplay elapsed={elapsed} limit={examDuration} />
          </div>
          <ProgressBar current={current + 1} total={questions.length} />

          {/* Centered Bookmarks Button */}
          <div
            style={{ display: "flex", justifyContent: "center", marginTop: 12 }}
          >
            <button
              onClick={() => setShowBookmarksModal(true)}
              style={{
                padding: "6px 16px",
                background: "var(--cream-dark)",
                border: "1px solid var(--cream-border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--ink-muted)",
                fontSize: "calc(12px * var(--scale, 1))",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ★ Bookmarks ({bookmarks.length})
            </button>
          </div>
        </div>

        {/* question */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            maxWidth: 600,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <div
            style={{
              background: "var(--cream)",
              border: "1px solid var(--cream-border)",
              borderRadius: "var(--radius)",
              padding: "24px 28px",
              marginBottom: 16,
              position: "relative",
            }}
          >
            <button
              onClick={() => {
                setBookmarks((prev) =>
                  prev.includes(current)
                    ? prev.filter((b) => b !== current)
                    : [...prev, current],
                );
              }}
              style={{
                position: "absolute",
                top: 16,
                right: 20,
                background: "none",
                border: "none",
                fontSize: "calc(20px * var(--scale, 1))",
                cursor: "pointer",
                opacity: bookmarks.includes(current) ? 1 : 0.3,
                color: bookmarks.includes(current)
                  ? "var(--sienna)"
                  : "var(--ink-muted)",
                transition: "all 0.2s",
              }}
              title="Bookmark Question"
            >
              ★
            </button>
            <div
              style={{
                fontSize: "calc(11px * var(--scale, 1))",
                color: "var(--ink-faint)",
                marginBottom: 10,
                fontWeight: 500,
              }}
            >
              Question {q.number}
            </div>
            <div
              style={{
                fontSize: "calc(15px * var(--scale, 1))",
                color: "var(--ink)",
                lineHeight: 1.65,
                fontWeight: 500,
              }}
            >
              {q.stem}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {q.options.map((opt) => {
              const isChosen = chosenLetter === opt.letter;
              const isCorrect = opt.correct;
              let bg = "var(--cream)",
                border = "var(--cream-border)",
                color = "var(--ink)";
              if (isRevealed) {
                if (isCorrect) {
                  bg = "var(--green-bg)";
                  border = "var(--green)";
                  color = "var(--green)";
                } else if (isChosen) {
                  bg = "var(--red-bg)";
                  border = "var(--red)";
                  color = "var(--red)";
                }
              } else if (isChosen) {
                bg = "var(--accent-bg)";
                border = "var(--accent-light)";
                color = "var(--accent)";
              }
              const disabled = mode === "immediate" && !!revealed[current];
              return (
                <div
                  key={opt.letter}
                  onClick={() => !disabled && choose(opt.letter)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 16px",
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: "var(--radius-sm)",
                    cursor: disabled ? "default" : "pointer",
                    transition: "all 0.12s",
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      flexShrink: 0,
                      border: `1.5px solid ${border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "calc(11px * var(--scale, 1))",
                      fontWeight: 500,
                      color,
                      background:
                        isChosen || (isRevealed && isCorrect)
                          ? bg
                          : "transparent",
                    }}
                  >
                    {opt.letter}
                  </div>
                  <div
                    style={{
                      fontSize: "calc(13px * var(--scale, 1))",
                      color,
                      lineHeight: 1.5,
                      paddingTop: 3,
                    }}
                  >
                    {opt.text}
                  </div>
                  {isRevealed && isCorrect && (
                    <div
                      style={{
                        marginLeft: "auto",
                        fontSize: "calc(11px * var(--scale, 1))",
                        color: "var(--green)",
                        fontWeight: 500,
                        flexShrink: 0,
                        paddingTop: 4,
                      }}
                    >
                      ✓ Correct
                    </div>
                  )}
                  {isRevealed && isChosen && !isCorrect && (
                    <div
                      style={{
                        marginLeft: "auto",
                        fontSize: "calc(11px * var(--scale, 1))",
                        color: "var(--red)",
                        fontWeight: 500,
                        flexShrink: 0,
                        paddingTop: 4,
                      }}
                    >
                      ✗ Wrong
                    </div>
                  )}
                </div>
              );
            })}

            {isRevealed && q.explanation && (
              <div
                style={{
                  marginTop: 8,
                  padding: "12px 16px",
                  background: "var(--cream-dark)",
                  borderLeft: "2px solid var(--accent)",
                  borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
                  fontSize: "calc(13px * var(--scale, 1))",
                  color: "var(--ink-muted)",
                  lineHeight: 1.5,
                }}
              >
                <strong>Explanation:</strong> {q.explanation}
              </div>
            )}
          </div>
        </div>

        {/* nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 20,
            maxWidth: 600,
            margin: "20px auto 0",
            width: "100%",
          }}
        >
          <button
            onClick={prev}
            disabled={current === 0}
            style={{ ...navBtn, opacity: current === 0 ? 0.35 : 1 }}
          >
            ← Previous
          </button>
          <button
            onClick={() => setShowFinishConfirm(true)}
            style={{
              ...navBtn,
              background: "var(--cream-dark)",
              color: "var(--ink-muted)",
              fontSize: "calc(12px * var(--scale, 1))",
              opacity: 0.6,
            }}
          >
            Submit early
          </button>
          <button
            onClick={isLast ? () => setShowFinishConfirm(true) : next}
            disabled={mode !== "end" && !answers[current]}
            style={{
              ...navBtn,
              background: isLast ? "var(--accent)" : "var(--cream-dark)",
              color: isLast ? "white" : "var(--ink)",
              border: isLast ? "none" : "1px solid var(--cream-border)",
              opacity: mode === "end" || answers[current] ? 1 : 0.4,
            }}
          >
            {isLast ? "Finish exam" : "Next →"}
          </button>
        </div>

        {/* Bookmarks Modal */}
        {showBookmarksModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "24px",
            }}
            onClick={() => setShowBookmarksModal(false)}
          >
            <div
              style={{
                background: "var(--cream)",
                border: "1px solid var(--cream-border)",
                borderRadius: "var(--radius)",
                padding: "24px",
                width: "100%",
                maxWidth: 400,
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: "calc(16px * var(--scale, 1))",
                    fontWeight: 600,
                    color: "var(--ink)",
                  }}
                >
                  Bookmarked Questions
                </h3>
                <button
                  onClick={() => setShowBookmarksModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "20px",
                    cursor: "pointer",
                    color: "var(--ink-muted)",
                  }}
                >
                  ×
                </button>
              </div>

              {bookmarks.length === 0 ? (
                <div
                  style={{
                    fontSize: "calc(13px * var(--scale, 1))",
                    color: "var(--ink-muted)",
                    textAlign: "center",
                    padding: "20px 0",
                  }}
                >
                  You haven't bookmarked any questions yet.
                </div>
              ) : (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {bookmarks
                    .sort((a, b) => a - b)
                    .map((bIdx) => (
                      <div
                        key={bIdx}
                        onClick={() => {
                          setCurrent(bIdx);
                          setShowBookmarksModal(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "12px 16px",
                          background: "var(--cream-dark)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--cream-border)",
                          cursor: "pointer",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "calc(14px * var(--scale, 1))",
                            fontWeight: 500,
                            color: "var(--ink)",
                          }}
                        >
                          Question {bIdx + 1}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookmarks((prev) =>
                              prev.filter((b) => b !== bIdx),
                            );
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            fontSize: "calc(18px * var(--scale, 1))",
                            color: "var(--sienna)",
                            cursor: "pointer",
                            padding: 0,
                          }}
                          title="Remove bookmark"
                        >
                          ★
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showFinishConfirm && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "24px",
            }}
          >
            <div
              style={{
                background: "var(--cream)",
                border: "1px solid var(--cream-border)",
                borderRadius: "var(--radius)",
                padding: "24px",
                width: "100%",
                maxWidth: 320,
                boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "calc(16px * var(--scale, 1))",
                  fontWeight: 600,
                  color: "var(--ink)",
                }}
              >
                Finish Exam?
              </h3>
              <p
                style={{
                  margin: "0 0 20px 0",
                  fontSize: "calc(13px * var(--scale, 1))",
                  color: "var(--ink-muted)",
                  lineHeight: 1.4,
                }}
              >
                Are you sure you want to finish and submit your answers?
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowFinishConfirm(false)}
                  style={{
                    padding: "8px 16px",
                    background: "var(--cream-dark)",
                    border: "1px solid var(--cream-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--ink)",
                    fontSize: "calc(13px * var(--scale, 1))",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowFinishConfirm(false);
                    finishExam(elapsed);
                  }}
                  style={{
                    padding: "8px 16px",
                    background: "var(--accent)",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    color: "white",
                    fontSize: "calc(13px * var(--scale, 1))",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Submit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>,
    );
  }

  // ── render: review
  if (phase === "review")
    return renderWithTabBar(
      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {timedOut && (
          <div
            style={{
              background: "var(--red-bg)",
              border: "1px solid var(--red)",
              borderRadius: "var(--radius-sm)",
              padding: "10px 14px",
              marginBottom: 16,
              fontSize: "calc(12px * var(--scale, 1))",
              color: "var(--red)",
              fontWeight: 500,
            }}
          >
            Time's up — exam submitted automatically.
          </div>
        )}

        {/* score banner */}
        <div
          style={{
            background: scoreBg(scorePercent),
            borderRadius: "var(--radius)",
            padding: "20px 24px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "calc(11px * var(--scale, 1))",
                fontWeight: 500,
                color: "var(--ink-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: 4,
              }}
            >
              Final score — {examCode}
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "calc(36px * var(--scale, 1))",
                color: scoreColor(scorePercent),
                lineHeight: 1,
              }}
            >
              {scorePercent}
              <span style={{ fontSize: "calc(18px * var(--scale, 1))" }}>
                /100
              </span>
            </div>
            <div
              style={{
                fontSize: "calc(12px * var(--scale, 1))",
                color: "var(--ink-muted)",
                marginTop: 6,
              }}
            >
              {correctCount} correct · {questions.length - correctCount} wrong ·{" "}
              {questions.length} total
            </div>
            {matchedSubject && matchedSubject.weight && (
              <div
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
                  color: scoreColor(scorePercent),
                  marginTop: 2,
                  fontWeight: 500,
                }}
              >
                {weightedContribution?.toFixed(1)}% / {matchedSubject.weight}%
                LLE Weighted Contribution
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: "calc(13px * var(--scale, 1))",
                fontWeight: 500,
                color: scoreColor(scorePercent),
              }}
            >
              {scoreLabel(scorePercent)}
            </div>
            <div
              style={{
                fontSize: "calc(11px * var(--scale, 1))",
                color: "var(--ink-faint)",
                marginTop: 4,
              }}
            >
              Time taken: {formatTime(elapsed)}
            </div>
            <div
              style={{
                fontSize: "calc(11px * var(--scale, 1))",
                color: "var(--ink-faint)",
              }}
            >
              {sessionType === "exam" || sessionType === "custom"
                ? "Score auto-logged to dashboard"
                : sessionType === "p2p"
                  ? "Score synced to P2P analytics"
                  : "Score not logged (Practice Mode)"}
            </div>
          </div>
        </div>

        {/* save prompt */}
        {(sessionType === "exam" ||
          sessionType === "custom" ||
          sessionType === "quiz") && (
          <div
            style={{
              background: "var(--cream)",
              border: "1px solid var(--cream-border)",
              borderRadius: "var(--radius)",
              padding: "14px 16px",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "calc(13px * var(--scale, 1))",
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginBottom: 2,
                }}
              >
                Save this {sessionType === "quiz" ? "quiz" : "exam"} result?
              </div>
              <div
                style={{
                  fontSize: "calc(11px * var(--scale, 1))",
                  color: "var(--ink-faint)",
                }}
              >
                Stores score, time taken, date, and all wrong answers for review
                later.
              </div>
            </div>
            {saved ? (
              <div
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
                  color: "var(--green)",
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                ✓ Saved
              </div>
            ) : (
              <button
                onClick={saveExam}
                style={{
                  padding: "8px 18px",
                  fontSize: "calc(13px * var(--scale, 1))",
                  fontWeight: 500,
                  background: "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  flexShrink: 0,
                }}
              >
                Save
              </button>
            )}
          </div>
        )}

        {/* wrong answers */}
        {wrongItems.length > 0 && (
          <>
            <div
              style={{
                fontSize: "calc(13px * var(--scale, 1))",
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 12,
              }}
            >
              Review — {wrongItems.length} incorrect
            </div>
            <WrongReview wrong={wrongItems} />
          </>
        )}
        {wrongItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "calc(18px * var(--scale, 1))",
                color: "#3D6B4F",
                marginBottom: 6,
              }}
            >
              Perfect score.
            </div>
            <div
              style={{
                fontSize: "calc(13px * var(--scale, 1))",
                color: "var(--ink-muted)",
              }}
            >
              Every single answer was correct.
            </div>
          </div>
        )}

        {/* actions */}
        <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
          <button
            onClick={startExam}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: "calc(13px * var(--scale, 1))",
              fontWeight: 500,
              background: "var(--accent-bg)",
              color: "var(--accent)",
              border: "1px solid var(--accent-light)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            Retake exam
          </button>
          {sessionType !== "classification" && (
            <button
              onClick={() => setPhase("configure")}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: "calc(13px * var(--scale, 1))",
                fontWeight: 500,
                background: "var(--cream-dark)",
                color: "var(--ink-muted)",
                border: "1px solid var(--cream-border)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Change settings
            </button>
          )}
          <button
            onClick={reset}
            style={{
              flex: 1,
              padding: "10px 0",
              fontSize: "calc(13px * var(--scale, 1))",
              fontWeight: 500,
              background: "var(--cream-dark)",
              color: "var(--ink-muted)",
              border: "1px solid var(--cream-border)",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            {sessionType === "p2p" ? "Back to P2P Sessions" : "Load new file"}
          </button>
        </div>
      </div>,
    );

  return null;
}

const navBtn: React.CSSProperties = {
  padding: "9px 20px",
  fontSize: "calc(13px * var(--scale, 1))",
  fontWeight: 500,
  borderRadius: "var(--radius-sm)",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
  background: "var(--cream-dark)",
  color: "var(--ink)",
  border: "1px solid var(--cream-border)",
};

const smallBtn: React.CSSProperties = {
  padding: "6px 12px",
  fontSize: "calc(12px * var(--scale, 1))",
  border: "1px solid var(--cream-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--cream-dark)",
  color: "var(--ink-muted)",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};
