import { useState, useRef, useCallback, useEffect } from "react";
import { loadSubjects } from "./App";

// ── types
type Option = { letter: string; text: string; correct: boolean };
type Question = {
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
  // match something like LOM_1 or RBU_3 at the start of file
  const match = firstLine.match(/^([A-Z]{2,6}_\d+)$/i);
  return match ? match[1].toUpperCase() : "";
}

function parseQuestions(raw: string): Question[] {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const questions: Question[] = [];
  let current: (Partial<Question> & { options: Option[] }) | null = null;

  // New format: Q. ..., O. ..., *O. ..., Y: ...
  // Old format: 1. ..., A. ..., *B. ...
  const questionReOld = /^(\d+)[.)]\s+(.+)$/;
  const questionReNew = /^Q\.\s+(.+)$/i;
  const optionReOld = /^(\*?)([A-Da-d])[.)]\s+(.+)$/;
  const optionReNew = /^(\*?)O\.\s+(.+)$/i;
  const explanationRe = /^Y:\s+(.+)$/i;

  // skip the exam code line
  const examCodeRe = /^[A-Z]{2,6}_\d+$/i;

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

      current = { number: questionCounter++, stem: stemText, options: [] };
    } else if ((oMatchOld || oMatchNew) && current) {
      const isCorrect = oMatchOld
        ? oMatchOld[1] === "*"
        : oMatchNew![1] === "*";
      const text = oMatchOld ? oMatchOld[3].trim() : oMatchNew![2].trim();

      let letter = "A";
      if (oMatchOld) {
        letter = oMatchOld[2].toUpperCase();
      } else {
        // Assign A, B, C, D dynamically based on existing options
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
): Question[] {
  // Shuffle all questions, take the subset, then map to assign new letters/numbers
  const subset = shuffleArray(allQuestions).slice(0, count);
  return subset.map((q, idx) => {
    // Shuffle options while re-assigning letters
    const shuffledOptions = shuffleArray(q.options).map((opt, oIdx) => {
      const letters = ["A", "B", "C", "D", "E", "F"];
      return { ...opt, letter: letters[oIdx] || "?" };
    });
    return { ...q, number: idx + 1, options: shuffledOptions };
  });
}

// ── storage helpers
const EXAMS_KEY = "saved-exams";

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

const EXAM_DURATION = 3600;

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
  const remaining = limit - elapsed;
  const pct = elapsed / limit;
  const urgent = remaining <= 300; // last 5 min
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
function PreviousExams() {
  const [exams, setExams] = useState<SavedExam[]>(loadSavedExams);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function deleteExam(id: string) {
    const next = exams.filter((e) => e.id !== id);
    setExams(next);
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
          No exams saved yet.
        </div>
        <div
          style={{
            fontSize: "calc(13px * var(--scale, 1))",
            color: "var(--ink-muted)",
          }}
        >
          After finishing an exam, save it to see it here.
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
        {exams.length} exam{exams.length !== 1 ? "s" : ""} saved
      </div>
      {exams.map((exam) => {
        const isOpen = expanded === exam.id;
        const isConfirm = confirmDelete === exam.id;

        const matchedSubject = allSubjects.find((s) =>
          exam.examCode.toUpperCase().startsWith(s.short),
        );
        const displayName = matchedSubject
          ? `${matchedSubject.name} · ${exam.examCode}`
          : exam.examCode;

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
  const [view, setView] = useState<"exam" | "history">("exam");
  const [phase, setPhase] = useState<ExamPhase>("load");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examCode, setExamCode] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [mode, setMode] = useState<SessionMode>("end");
  const [dragOver, setDragOver] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
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

  // timer
  const [elapsed, setElapsed] = useState(0);
  const [examStartTime, setExamStartTime] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        if (e + 1 >= EXAM_DURATION) {
          clearInterval(timerRef.current!);
          // auto-finish via ref to avoid stale closure via a flag
          return EXAM_DURATION;
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
    if (elapsed >= EXAM_DURATION && phase === "exam") {
      finishExam(elapsed);
    }
  }, [elapsed, phase]);

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
      setParseError("Please upload a .txt file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const code = parseExamCode(text);
      const parsed = parseQuestions(text);
      if (parsed.length === 0) {
        setParseError("No questions found. Check the format guide below.");
        return;
      }
      // Shuffle options for custom uploads as well so AI generated questions aren't predictable
      const shuffledParsed = processQuestionsSubset(parsed, parsed.length);
      setQuestions(shuffledParsed);
      setExamCode(code);
      setFileName(file.name);
      setParseError("");
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

  async function fetchBuiltIn(subjectShort: string, count: number) {
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
    else finishExam(elapsed);
  }
  function prev() {
    if (current > 0) setCurrent((c) => c - 1);
  }

  function finishExam(timeTaken: number) {
    stopTimer();
    // compute results using current answers state
    setAnswers((currentAnswers) => {
      const correct = questions.filter((q, i) => {
        const chosen = currentAnswers[i];
        return chosen && q.options.find((o) => o.letter === chosen)?.correct;
      }).length;
      const score = Math.round((correct / questions.length) * 100);
      saveJSON(scoreKey(new Date()), score);

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
      };
      setPendingExam(examRecord);
      setPhase("review");
      return currentAnswers;
    });
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
  const timedOut = elapsed >= EXAM_DURATION;

  // LLE TOS weighting logic
  const allSubjects = loadSubjects();
  // Find subject match by checking if the examCode starts with the subject's short code (e.g., LOM_1 -> LOM)
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
      }}
    >
      {(["exam", "history"] as const).map((t) => (
        <button
          key={t}
          onClick={() => setView(t)}
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
          }}
        >
          {t === "history" ? "Previous Exams" : "Exam"}
        </button>
      ))}
    </div>
  );

  // ── render: history
  if (view === "history")
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {tabBar}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <PreviousExams />
        </div>
      </div>
    );

  // ── render: load
  if (phase === "load")
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {tabBar}
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
                      fetchBuiltIn(subj.short, subjectSelector.count)
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
                    Take a Quiz
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
                    Take a Mock Exam
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
      </div>
    );

  // ── render: configure
  if (phase === "configure")
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {tabBar}
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
                      mode === opt.value ? "var(--accent-bg)" : "var(--cream)",
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
            <span style={{ fontSize: "calc(16px * var(--scale, 1))" }}>⏱</span>
            Strict 1-hour timer. Exam auto-submits when time runs out.
          </div>

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
      </div>
    );

  // ── render: exam
  if (phase === "exam" && q) {
    const isLast = current === questions.length - 1;
    return (
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
            <TimerDisplay elapsed={elapsed} limit={EXAM_DURATION} />
          </div>
          <ProgressBar current={current + 1} total={questions.length} />
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
            }}
          >
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
            onClick={() => finishExam(elapsed)}
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
            onClick={isLast ? () => finishExam(elapsed) : next}
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
      </div>
    );
  }

  // ── render: review
  if (phase === "review")
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {tabBar}
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
                {correctCount} correct · {questions.length - correctCount} wrong
                · {questions.length} total
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
                Score auto-logged to dashboard
              </div>
            </div>
          </div>

          {/* save prompt */}
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
                Save this exam result?
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
              Load new file
            </button>
          </div>
        </div>
      </div>
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
