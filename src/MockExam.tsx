import { useState, useRef, useCallback, useEffect } from "react";

// ── types ─────────────────────────────────────────────────────────────────────
type Option = { letter: string; text: string; correct: boolean };
type Question = { number: number; stem: string; options: Option[] };
type SessionMode = "immediate" | "end";
type ExamPhase = "load" | "configure" | "exam" | "review" | "history";

type WrongItem = {
  number: number;
  stem: string;
  chosen: string | undefined;
  correctLetter: string;
  correctText: string;
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

// ── embedded subject short codes
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

  const questionRe = /^(\d+)[.)]\s+(.+)$/;
  const optionRe = /^(\*?)([A-Da-d])[.)]\s+(.+)$/;
  const examCodeRe = /^[A-Z]{2,6}_\d+$/i;

  for (const line of lines) {
    if (examCodeRe.test(line)) continue;
    const qMatch = line.match(questionRe);
    const oMatch = line.match(optionRe);
    if (qMatch && !oMatch) {
      if (current && current.stem && current.options.length > 0)
        questions.push(current as Question);
      current = { number: parseInt(qMatch[1]), stem: qMatch[2], options: [] };
    } else if (oMatch && current) {
      current.options.push({
        letter: oMatch[2].toUpperCase(),
        text: oMatch[3].trim(),
        correct: oMatch[1] === "*",
      });
    } else if (current && !qMatch && !oMatch && line.length > 0) {
      current.stem += " " + line;
    }
  }
  if (current && current.stem && current.options.length > 0)
    questions.push(current as Question);
  return questions;
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
      <span style={{ fontSize: 11, color: "var(--ink-faint)", flexShrink: 0 }}>
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
          fontSize: 12,
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
            fontSize: 18,
            color: "var(--green)",
            marginBottom: 6,
          }}
        >
          Perfect score.
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
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
            style={{ fontSize: 11, color: "var(--ink-faint)", marginBottom: 6 }}
          >
            Q{w.number}
          </div>
          <div
            style={{
              fontSize: 13,
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
                    fontSize: 10,
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
                  style={{ fontSize: 12, color: "var(--red)", lineHeight: 1.5 }}
                >
                  Your answer
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
                  fontSize: 10,
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
                style={{ fontSize: 12, color: "var(--green)", lineHeight: 1.5 }}
              >
                {w.correctText} — correct answer
              </span>
            </div>
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

  if (exams.length === 0)
    return (
      <div style={{ padding: "32px 24px", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 18,
            color: "var(--ink)",
            marginBottom: 8,
          }}
        >
          No exams saved yet.
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
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
      <div style={{ fontSize: 12, color: "var(--ink-muted)", marginBottom: 4 }}>
        {exams.length} exam{exams.length !== 1 ? "s" : ""} saved
      </div>
      {exams.map((exam) => {
        const isOpen = expanded === exam.id;
        const isConfirm = confirmDelete === exam.id;
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
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    {exam.examCode}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
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
                <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                  {formatDateDisplay(exam.date)} · {formatTime(exam.timeTaken)}{" "}
                  taken
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    color: scoreColor(exam.score),
                    lineHeight: 1,
                  }}
                >
                  {exam.score}
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>
                  {exam.correct}/{exam.total}
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
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
                      fontSize: 11,
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
                      fontSize: 11,
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
                      fontSize: 11,
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
                        fontSize: 12,
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
                      fontSize: 13,
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
                      <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
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
export default function MockExam() {
  const [view, setView] = useState<"exam" | "history">("exam");
  const [phase, setPhase] = useState<ExamPhase>("load");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examCode, setExamCode] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [mode, setMode] = useState<SessionMode>("end");
  const [dragOver, setDragOver] = useState(false);

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
          // auto-finish via ref to avoid stale closure via flag
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

  // ── file loading ──
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
      setQuestions(parsed);
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

  // ── exam logic ──
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
          const correctOpt = q.options.find((o) => o.correct);
          const isWrong =
            !chosen || !q.options.find((o) => o.letter === chosen)?.correct;
          if (!isWrong) return null;
          return {
            number: q.number,
            stem: q.stem,
            chosen,
            correctLetter: correctOpt?.letter || "",
            correctText: correctOpt?.text || "",
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

  // ── computed ──
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
      const correctOpt = q.options.find((o) => o.correct);
      if (chosen && q.options.find((o) => o.letter === chosen)?.correct)
        return null;
      return {
        number: q.number,
        stem: q.stem,
        chosen,
        correctLetter: correctOpt?.letter || "",
        correctText: correctOpt?.text || "",
      };
    })
    .filter(Boolean) as WrongItem[];

  const q = questions[current];
  const chosenLetter = answers[current];
  const isRevealed =
    mode === "immediate" ? !!revealed[current] : phase === "review";
  const timedOut = elapsed >= EXAM_DURATION;

  // ── tab bar ──
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
            fontSize: 13,
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

  // ── render: history ──
  if (view === "history")
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {tabBar}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <PreviousExams />
        </div>
      </div>
    );

  // ── render: load ──
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
                fontSize: 20,
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              Mock Exam
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Load a question file to begin your session.
            </div>
          </div>

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
              background: dragOver ? "var(--accent-bg)" : "var(--cream-dark)",
              transition: "all 0.15s",
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              Drop your .txt file here
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
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

          {parseError && (
            <div
              style={{
                fontSize: 12,
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
                fontSize: 12,
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 8,
              }}
            >
              Expected file format
            </div>
            <pre
              style={{
                fontSize: 11,
                color: "var(--ink-muted)",
                lineHeight: 1.7,
                fontFamily: "var(--font-mono, monospace)",
                margin: 0,
                whiteSpace: "pre-wrap",
              }}
            >{`LOM_1

1. Which of the following is a cataloging standard?
*A. AACR2
B. HTML
C. SQL
D. ISBN

2. The Dewey Decimal System classifies by?
A. Author name
*B. Subject
C. Publication year
D. Country`}</pre>
            <div
              style={{
                fontSize: 11,
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
              ). Prefix the correct option with{" "}
              <code
                style={{
                  background: "var(--cream-dark)",
                  padding: "1px 5px",
                  borderRadius: 3,
                }}
              >
                *
              </code>{" "}
              before the letter.
            </div>
          </div>
        </div>
      </div>
    );

  // ── render: configure ──
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
                fontSize: 20,
                color: "var(--ink)",
                marginBottom: 4,
              }}
            >
              Session setup
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
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
                fontSize: 12,
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
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--ink)",
                      }}
                    >
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
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
              fontSize: 12,
              color: "var(--ink-muted)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 16 }}>⏱</span>
            Strict 1-hour timer. Exam auto-submits when time runs out.
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={startExam}
              style={{
                flex: 1,
                padding: "10px 0",
                fontSize: 13,
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
                fontSize: 13,
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

  // ── render: exam ──
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
              <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                {examCode} · {mode === "immediate" ? "Immediate" : "Full exam"}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-muted)" }}>
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
                fontSize: 11,
                color: "var(--ink-faint)",
                marginBottom: 10,
                fontWeight: 500,
              }}
            >
              Question {q.number}
            </div>
            <div
              style={{
                fontSize: 15,
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
                      fontSize: 11,
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
                      fontSize: 13,
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
                        fontSize: 11,
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
                        fontSize: 11,
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
              fontSize: 12,
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

  // ── render: review ──
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
                fontSize: 12,
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
                  fontSize: 11,
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
                  fontSize: 36,
                  color: scoreColor(scorePercent),
                  lineHeight: 1,
                }}
              >
                {scorePercent}
                <span style={{ fontSize: 18 }}>/100</span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--ink-muted)",
                  marginTop: 6,
                }}
              >
                {correctCount} correct · {questions.length - correctCount} wrong
                · {questions.length} total
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: scoreColor(scorePercent),
                }}
              >
                {scoreLabel(scorePercent)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--ink-faint)",
                  marginTop: 4,
                }}
              >
                Time taken: {formatTime(elapsed)}
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
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
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginBottom: 2,
                }}
              >
                Save this exam result?
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                Stores score, time taken, date, and all wrong answers for review
                later.
              </div>
            </div>
            {saved ? (
              <div
                style={{
                  fontSize: 12,
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
                  fontSize: 13,
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
                  fontSize: 13,
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
                  fontSize: 18,
                  color: "#3D6B4F",
                  marginBottom: 6,
                }}
              >
                Perfect score.
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-muted)" }}>
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
                fontSize: 13,
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
                fontSize: 13,
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
                fontSize: 13,
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
  fontSize: 13,
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
  fontSize: 12,
  border: "1px solid var(--cream-border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--cream-dark)",
  color: "var(--ink-muted)",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};
