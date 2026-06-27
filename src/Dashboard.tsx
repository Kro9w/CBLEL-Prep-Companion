import { useState, useEffect } from "react";
import {
  buildChecklist,
  isRestDay,
  getSubjectForDate,
  getDaysUntil,
  DEFAULT_SUBJECTS,
} from "./App";
import type { MilestoneData } from "./App";

// ── quotes compiled by me hehe
const QUOTES = [
  {
    text: "The struggle itself toward the heights is enough to fill a man's heart.",
    author: "Albert Camus",
  },
  {
    text: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
  },
  {
    text: "You have power over your mind—not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
  },
  {
    text: "You do not rise to the level of your goals. You fall to the level of your systems.",
    author: "James Clear",
  },
  {
    text: "You are in danger of living a life so comfortable and soft that you will die without ever realizing your true potential.",
    author: "David Goggins",
  },
  {
    text: "Today is victory over yourself of yesterday; tomorrow is your victory over lesser men.",
    author: "Miyamoto Musashi",
  },
  {
    text: "Desire is a contract you make with yourself to be unhappy until you get what you want.",
    author: "Naval Ravikant",
  },
  {
    text: "Clarity about what matters provides clarity about what does not.",
    author: "Cal Newport",
  },
  { text: "Discipline equals freedom.", author: "Jocko Willink" },
  {
    text: "We suffer more often in imagination than in reality.",
    author: "Seneca",
  },
  {
    text: "Do not pray for an easy life. Pray for the strength to endure a difficult one.",
    author: "Bruce Lee",
  },
  {
    text: "The man who moves a mountain begins by carrying away small stones.",
    author: "Confucius",
  },
  {
    text: "Hard choices, easy life. Easy choices, hard life.",
    author: "Jerzy Gregorek",
  },
  {
    text: "It is not that we have a short time to live, but that we waste a lot of it.",
    author: "Seneca",
  },
  {
    text: "The first and greatest victory is to conquer self.",
    author: "Plato",
  },
  {
    text: "Suffer the pain of discipline or suffer the pain of regret.",
    author: "Jim Rohn",
  },
  {
    text: "Don't count the days. Make the days count.",
    author: "Muhammad Ali",
  },
  {
    text: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius",
  },
  {
    text: "Excellence is not a gift but a skill that takes practice.",
    author: "Plato",
  },
  {
    text: "A man is what he thinks about all day long.",
    author: "Ralph Waldo Emerson",
  },
  {
    text: "The successful warrior is the average man, with laser-like focus.",
    author: "Bruce Lee",
  },
  {
    text: "Motivation gets you started. Habit keeps you going.",
    author: "Jim Ryun",
  },
  {
    text: "Champions aren't made in gyms. Champions are made from something deep inside them.",
    author: "Muhammad Ali",
  },
  {
    text: "Small disciplines repeated with consistency every day lead to great achievements gained slowly over time.",
    author: "John C. Maxwell",
  },
  {
    text: "The quality of your practice is the quality of your performance.",
    author: "Robin Sharma",
  },
];

function getDailyQuote() {
  const idx = Math.floor(Date.now() / 86400000) % QUOTES.length;
  return QUOTES[idx];
}

// ── storage helpers
function loadSavedExams() {
  try {
    const s = localStorage.getItem("saved-exams");
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function checksKey(d: Date) {
  return `checks-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function customKey(d: Date) {
  return `custom-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function deletedKey(d: Date) {
  return `deleted-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function scoreKey(d: Date) {
  return `score-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
export function quizCompletedKey(d: Date) {
  return `quiz-completed-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ── day-completion logic (AT LEAST 50% of tasks done)
function isDayCompleted(
  d: Date,
  startDateStr: string,
  subjects: typeof DEFAULT_SUBJECTS,
  cycleLength: number,
  studyDays: number[],
): boolean {
  if (isRestDay(d, studyDays)) return true;
  // A day is considered complete if there is an exam score or quiz logged for it
  const score = loadJSON<number | null>(scoreKey(d), null);
  const quiz = loadJSON<boolean | null>(quizCompletedKey(d), null);
  return score !== null || quiz !== null;
}

function computeStreak(
  startDateStr: string,
  subjects: typeof DEFAULT_SUBJECTS,
  cycleLength: number,
  studyDays: number[],
): number {
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(today);
  const startDate = new Date(startDateStr);
  startDate.setHours(0, 0, 0, 0);

  while (d >= startDate) {
    if (isRestDay(d, studyDays)) {
      d.setDate(d.getDate() - 1);
      continue;
    }
    if (!isDayCompleted(d, startDateStr, subjects, cycleLength, studyDays))
      break;
    streak++;
    d.setDate(d.getDate() - 1);
    if (streak > 300) break;
  }
  return streak;
}

function computeStudyStats(
  startDateStr: string,
  subjects: typeof DEFAULT_SUBJECTS,
  cycleLength: number,
  studyDays: number[],
): { completed: number; total: number; actualCompleted: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(startDateStr);
  d.setHours(0, 0, 0, 0);
  let total = 0,
    completed = 0,
    actualCompleted = 0;
  while (d <= today) {
    if (!isRestDay(d, studyDays)) {
      total++;
      // Using exam completion for both now
      if (isDayCompleted(d, startDateStr, subjects, cycleLength, studyDays)) {
        completed++;
        actualCompleted++;
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return { completed, total, actualCompleted };
}

function getLast30Scores(
  studyDays: number[],
): { date: string; score: number }[] {
  const results: { date: string; score: number }[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    if (!isRestDay(dd, studyDays)) {
      const s = loadJSON<number | null>(scoreKey(dd), null);
      if (s !== null)
        results.push({
          date: `${MONTH_SHORT[dd.getMonth()]} ${dd.getDate()}`,
          score: s,
        });
    }
  }
  return results;
}

function getWeekDates(offset: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(today);
  d.setDate(today.getDate() + offset * 7);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return dd;
  });
}

// ── sub-components
function StatCard({
  label,
  value,
  sub,
  color,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--cream)",
        border: "1px solid var(--cream-border)",
        borderRadius: "var(--radius)",
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div
        style={{
          fontSize: "calc(11px * var(--scale, 1))",
          color: "var(--ink-faint)",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "calc(28px * var(--scale, 1))",
          color: color || "var(--ink)",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: "calc(11px * var(--scale, 1))",
            color: "var(--ink-muted)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function MiniLineChart({
  scores,
}: {
  scores: { date: string; score: number }[];
}) {
  if (scores.length === 0)
    return (
      <div
        style={{
          height: 90,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: "calc(12px * var(--scale, 1))",
            color: "var(--ink-faint)",
            fontStyle: "italic",
          }}
        >
          Complete a mock exam to see scores here
        </span>
      </div>
    );
  const W = 500,
    H = 90,
    PAD = { top: 10, right: 12, bottom: 20, left: 28 };
  const innerW = W - PAD.left - PAD.right,
    innerH = H - PAD.top - PAD.bottom;
  const min = Math.max(0, Math.min(...scores.map((s) => s.score)) - 10);
  const max = Math.min(100, Math.max(...scores.map((s) => s.score)) + 5);
  const range = max - min || 1;
  const pts = scores.map((s, i) => ({
    x: PAD.left + (i / Math.max(scores.length - 1, 1)) * innerW,
    y: PAD.top + (1 - (s.score - min) / range) * innerH,
    ...s,
  }));
  const pathD = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");
  const areaD =
    pts.length > 1
      ? `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(PAD.top + innerH).toFixed(1)} Z`
      : "";
  const gridLines = [0, 25, 50, 75, 90, 100]
    .map((v) => ({ v, y: PAD.top + (1 - (v - min) / range) * innerH }))
    .filter((g) => g.y >= PAD.top && g.y <= PAD.top + innerH);
  const last = pts[pts.length - 1];
  const avg = Math.round(
    scores.reduce((a, s) => a + s.score, 0) / scores.length,
  );
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((g) => (
          <g key={g.v}>
            <line
              x1={PAD.left}
              y1={g.y}
              x2={PAD.left + innerW}
              y2={g.y}
              stroke="var(--cream-border)"
              strokeWidth="0.5"
              strokeDasharray="3,3"
            />
            <text
              x={PAD.left - 4}
              y={g.y + 3.5}
              textAnchor="end"
              fontSize="8"
              fill="var(--ink-faint)"
            >
              {g.v}
            </text>
          </g>
        ))}
        {areaD && <path d={areaD} fill="url(#ag)" />}
        {pts.length > 1 && (
          <path
            d={pathD}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="var(--accent)" />
        ))}
        {last && (
          <text
            x={last.x}
            y={last.y - 6}
            textAnchor="middle"
            fontSize="9"
            fontWeight="500"
            fill="var(--accent)"
          >
            {last.score}
          </text>
        )}
        {scores.length > 1 && (
          <>
            <text
              x={pts[0].x}
              y={PAD.top + innerH + 14}
              textAnchor="middle"
              fontSize="8"
              fill="var(--ink-faint)"
            >
              {scores[0].date}
            </text>
            <text
              x={last.x}
              y={PAD.top + innerH + 14}
              textAnchor="middle"
              fontSize="8"
              fill="var(--ink-faint)"
            >
              {scores[scores.length - 1].date}
            </text>
          </>
        )}
      </svg>
      <div
        style={{
          fontSize: "calc(11px * var(--scale, 1))",
          color: "var(--ink-faint)",
          marginTop: 4,
          textAlign: "right",
        }}
      >
        {scores.length} exam{scores.length !== 1 ? "s" : ""} · avg {avg}/100
      </div>
    </div>
  );
}

function WeeklyOverview({
  weekOffset,
  startDateStr,
  subjects,
  cycleLength,
  studyDays,
}: {
  weekOffset: number;
  startDateStr: string;
  subjects: typeof DEFAULT_SUBJECTS;
  cycleLength: number;
  studyDays: number[];
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekDates = getWeekDates(weekOffset);
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
        gap: 6,
      }}
    >
      {weekDates.map((d) => {
        const isToday = d.toDateString() === today.toDateString();
        const past = d < today;
        const rest = isRestDay(d, studyDays);
        const { short } = getSubjectForDate(
          d,
          startDateStr,
          subjects,
          cycleLength,
          studyDays,
        );
        const score = loadJSON<number | null>(scoreKey(d), null);
        let completion = 0;
        if (!rest) {
          const deletedTasks: string[] = loadJSON(deletedKey(d), []);
          const builtIds = buildChecklist(
            d,
            startDateStr,
            subjects,
            cycleLength,
            studyDays,
          )
            .map((i) => i.id)
            .filter((id) => !deletedTasks.includes(id));
          const custom: { id: string }[] = loadJSON(customKey(d), []);
          const allIds = [...builtIds, ...custom.map((t) => t.id)];
          const checks = loadJSON<Record<string, boolean>>(checksKey(d), {});
          const done = allIds.filter((id) => checks[id]).length;
          completion = allIds.length > 0 ? done / allIds.length : 0;
        }
        return (
          <div
            key={d.toISOString()}
            style={{
              background: isToday ? "var(--accent-bg)" : "var(--cream)",
              border: `1px solid ${isToday ? "var(--accent-light)" : "var(--cream-border)"}`,
              borderRadius: "var(--radius-sm)",
              padding: "8px 6px",
              opacity: past && !isToday ? 0.75 : 1,
            }}
          >
            <div
              style={{
                fontSize: "calc(10px * var(--scale, 1))",
                fontWeight: 500,
                color: isToday ? "var(--accent)" : "var(--ink-faint)",
                marginBottom: 2,
              }}
            >
              {DAY_SHORT[d.getDay()]}
            </div>
            <div
              style={{
                fontSize: "calc(12px * var(--scale, 1))",
                fontWeight: 500,
                color: "var(--ink)",
                marginBottom: 6,
              }}
            >
              {d.getDate()}
            </div>
            {rest ? (
              <div
                style={{
                  fontSize: "calc(9px * var(--scale, 1))",
                  color: "var(--ink-faint)",
                  fontStyle: "italic",
                }}
              >
                rest
              </div>
            ) : (
              <>
                <div
                  style={{
                    fontSize: "calc(9px * var(--scale, 1))",
                    padding: "1px 4px",
                    borderRadius: 3,
                    marginBottom: 3,
                    background: "var(--blue-bg)",
                    color: "var(--blue)",
                  }}
                >
                  {short}
                </div>
                {score !== null && (
                  <div
                    style={{
                      fontSize: "calc(9px * var(--scale, 1))",
                      padding: "1px 4px",
                      borderRadius: 3,
                      marginBottom: 3,
                      background:
                        score >= 90
                          ? "var(--green-bg)"
                          : score >= 75
                            ? "var(--blue-bg)"
                            : score >= 50
                              ? "var(--accent-bg)"
                              : "var(--red-bg)",
                      color:
                        score >= 90
                          ? "var(--green)"
                          : score >= 75
                            ? "var(--blue)"
                            : score >= 50
                              ? "var(--accent)"
                              : "var(--red)",
                    }}
                  >
                    {score}/100
                  </div>
                )}
                {completion > 0 && (
                  <div
                    style={{
                      height: 3,
                      background: "var(--cream-border)",
                      borderRadius: 2,
                      marginTop: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${completion * 100}%`,
                        background:
                          completion >= 1 ? "var(--green)" : "var(--accent)",
                        borderRadius: 2,
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── main dashboard proper
export default function Dashboard({
  userName,
  startDateStr,
  subjects,
  milestones,
  cycleLength,
  studyDays,
  onNavigateToPractice,
}: {
  userName: string;
  startDateStr: string;
  subjects: typeof DEFAULT_SUBJECTS;
  milestones: MilestoneData[];
  cycleLength: number;
  studyDays: number[];
  onNavigateToPractice: () => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);

  const [weaknesses, setWeaknesses] = useState<
    { short: string; name: string; score: number }[]
  >([]);
  const [p2pWeaknesses, setP2pWeaknesses] = useState<
    {
      short: string;
      name: string;
      score: number;
      preScore: number | null;
      postScore: number | null;
    }[]
  >([]);
  const [showP2p, setShowP2p] = useState(false);

  useEffect(() => {
    const exams = loadSavedExams();
    const subjectStats: Record<
      string,
      { totalScore: number; count: number; name: string }
    > = {};

    subjects.forEach((s) => {
      subjectStats[s.short] = { totalScore: 0, count: 0, name: s.name };
    });

    const p2pStats: Record<
      string,
      { preScore: number | null; postScore: number | null }
    > = {};
    subjects.forEach((s) => {
      p2pStats[s.short] = { preScore: null, postScore: null };
    });

    exams.forEach((e: any) => {
      // e.examCode is something like "LOM_1" or "LOM"
      const shortCode = e.examCode?.split("_")[0];

      if (e.sessionType === "p2p" && e.examCode) {
        const type = e.examCode.split("_")[1]; // PRE or POST
        if (shortCode && p2pStats[shortCode]) {
          if (type === "PRE") p2pStats[shortCode].preScore = e.score;
          if (type === "POST") p2pStats[shortCode].postScore = e.score;
        }
      } else {
        if (shortCode && subjectStats[shortCode] && e.sessionType !== "p2p") {
          subjectStats[shortCode].totalScore += e.score;
          subjectStats[shortCode].count += 1;
        }
      }
    });

    const calculated = subjects.map((s) => {
      const stat = subjectStats[s.short];
      const avgScore =
        stat.count > 0 ? Math.round(stat.totalScore / stat.count) : null;
      return {
        short: s.short,
        name: s.name,
        score: avgScore,
      };
    });

    // Make sure we have 6 subjects
    setWeaknesses(
      calculated as { short: string; name: string; score: number }[],
    );

    const calculatedP2p = subjects.map((s) => {
      const stats = p2pStats[s.short];
      // Display the post score if it exists, otherwise pre score.
      // If neither, then null.
      const scoreToUse =
        stats.postScore !== null ? stats.postScore : stats.preScore;
      return {
        short: s.short,
        name: s.name,
        score: scoreToUse,
        preScore: stats.preScore,
        postScore: stats.postScore,
      };
    });
    setP2pWeaknesses(calculatedP2p as any);
  }, [subjects]);

  const activeWeaknesses = showP2p ? p2pWeaknesses : weaknesses;

  const validWeaknesses = activeWeaknesses.filter((w) => w.score !== null);
  const totalGWA =
    validWeaknesses.length > 0
      ? Math.round(
          validWeaknesses.reduce((a, b) => a + b.score, 0) /
            validWeaknesses.length,
        )
      : null;

  // Find the subject with the lowest score for the report
  const sortedWeaknesses = [...validWeaknesses].sort(
    (a, b) => a.score - b.score,
  );
  const lowestSubject =
    sortedWeaknesses.length > 0 ? sortedWeaknesses[0] : null;
  const [scores, setScores] = useState<{ date: string; score: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [studyStats, setStudyStats] = useState({
    completed: 0,
    total: 0,
    actualCompleted: 0,
  });

  useEffect(() => {
    setScores(getLast30Scores(studyDays));
    setStreak(computeStreak(startDateStr, subjects, cycleLength, studyDays));
    setStudyStats(
      computeStudyStats(startDateStr, subjects, cycleLength, studyDays),
    );
  }, [startDateStr, subjects, cycleLength, studyDays]);

  const today = new Date();
  const startDate = new Date(startDateStr);
  startDate.setHours(0, 0, 0, 0);
  const examMs = milestones.find((m) => m.id === "exam")!;
  const examDate = new Date(examMs.dateStr);
  const daysToBoard = getDaysUntil(examDate);
  const totalStudyDays = Math.floor(
    (examDate.getTime() - startDate.getTime()) / 86400000,
  );
  const studyDaysElapsed = Math.floor(
    (today.getTime() - startDate.getTime()) / 86400000,
  );
  const studyProgress =
    totalStudyDays > 0
      ? Math.min(1, Math.max(0, studyDaysElapsed / totalStudyDays))
      : 0;
  // completion rate uses actual 100% completions
  const completionRate =
    studyStats.total > 0
      ? Math.round((studyStats.actualCompleted / studyStats.total) * 100)
      : 0;

  const latestScore =
    scores.length > 0 ? scores[scores.length - 1].score : null;
  const avgScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length)
      : null;
  const bestScore =
    scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : null;

  const { subject: currentSubject } = getSubjectForDate(
    today,
    startDateStr,
    subjects,
    cycleLength,
    studyDays,
  );

  const isTodayCompleted = isDayCompleted(
    today,
    startDateStr,
    subjects,
    cycleLength,
    studyDays,
  );

  const scoreColor =
    latestScore !== null
      ? latestScore >= 90
        ? "var(--green)"
        : latestScore >= 75
          ? "var(--blue)"
          : latestScore >= 50
            ? "var(--accent)"
            : "var(--red)"
      : "var(--ink-faint)";

  const quote = getDailyQuote();

  return (
    <div
      style={{
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* quote */}
      <div
        style={{
          background: "var(--cream-dark)",
          border: "1px solid var(--cream-border)",
          borderLeft: "3px solid var(--accent)",
          borderRadius: "var(--radius)",
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "calc(15px * var(--scale, 1))",
            color: "var(--ink)",
            lineHeight: 1.6,
            fontStyle: "italic",
            marginBottom: 10,
          }}
        >
          "{quote.text}"
        </div>
        <div
          style={{
            fontSize: "calc(11px * var(--scale, 1))",
            fontWeight: 500,
            color: "var(--accent)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          — {quote.author}
        </div>
      </div>

      {/* stat cards */}
      <div
        className="dashboard-stats-grid-4"
        style={{ gap: 10, marginBottom: 24 }}
      >
        <StatCard
          label="Days to CBLEL"
          value={daysToBoard}
          sub={examDate.toLocaleDateString("en-PH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          color="var(--accent)"
        />
        <StatCard
          label="Study streak"
          value={
            <span style={{ opacity: isTodayCompleted ? 1 : 0.4 }}>
              {isTodayCompleted ? streak : 0}d
            </span>
          }
          sub={streak > 0 ? "Keep going!" : "Take an exam today"}
          color={streak >= 5 ? "var(--green)" : "var(--ink)"}
          onClick={!isTodayCompleted ? onNavigateToPractice : undefined}
        />
        <StatCard
          label="Days completed"
          value={`${studyStats.completed}/${studyStats.total}`}
          sub={`${completionRate}% full completion rate`}
        />
        <StatCard
          label="Latest score"
          value={latestScore !== null ? `${latestScore}` : "—"}
          sub={
            avgScore !== null
              ? `avg ${avgScore} · best ${bestScore}`
              : "No scores yet"
          }
          color={scoreColor}
        />
      </div>

      {/* journey bar */}
      <div
        style={{
          background: "var(--cream)",
          border: "1px solid var(--cream-border)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: "calc(13px * var(--scale, 1))",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            {userName}'s journey to board exam
          </span>
          <span
            style={{
              fontSize: "calc(12px * var(--scale, 1))",
              color: "var(--ink-muted)",
            }}
          >{`Studying: ${currentSubject}`}</span>
        </div>
        <div
          style={{
            height: 6,
            background: "var(--cream-border)",
            borderRadius: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${studyProgress * 100}%`,
              background:
                "linear-gradient(90deg, var(--accent-light), var(--accent))",
              borderRadius: 3,
              transition: "width 0.5s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
          }}
        >
          <span
            style={{
              fontSize: "calc(10px * var(--scale, 1))",
              color: "var(--ink-faint)",
            }}
          >
            {startDate.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          <span
            style={{
              fontSize: "calc(10px * var(--scale, 1))",
              fontWeight: 500,
              color: "var(--accent)",
            }}
          >
            {Math.round(studyProgress * 100)}% through prep
          </span>
          <span
            style={{
              fontSize: "calc(10px * var(--scale, 1))",
              color: "var(--ink-faint)",
            }}
          >
            {examDate.toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* mock exam chart */}
      <div
        style={{
          background: "var(--cream)",
          border: "1px solid var(--cream-border)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: "calc(13px * var(--scale, 1))",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Mock exam scores — last 30 days
          </span>
          {scores.length > 0 && (
            <div style={{ display: "flex", gap: 10 }}>
              {[
                { label: "Avg", value: avgScore },
                { label: "Best", value: bestScore },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "calc(10px * var(--scale, 1))",
                      color: "var(--ink-faint)",
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontSize: "calc(14px * var(--scale, 1))",
                      fontWeight: 500,
                      color: "var(--ink)",
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <MiniLineChart scores={scores} />
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {[
            {
              label: "90–100",
              note: "Topnotcher",
              bg: "var(--green-bg)",
              color: "var(--green)",
            },
            {
              label: "75–89",
              note: "Passing",
              bg: "var(--blue-bg)",
              color: "var(--blue)",
            },
            {
              label: "50–74",
              note: "Keep pushing",
              bg: "var(--accent-bg)",
              color: "var(--accent)",
            },
            {
              label: "0–49",
              note: "Review",
              bg: "var(--red-bg)",
              color: "var(--red)",
            },
          ].map((b) => (
            <div
              key={b.label}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                background: b.bg,
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: "calc(10px * var(--scale, 1))",
                  fontWeight: 500,
                  color: b.color,
                }}
              >
                {b.label}
              </div>
              <div
                style={{
                  fontSize: "calc(9px * var(--scale, 1))",
                  color: b.color,
                  opacity: 0.8,
                }}
              >
                {b.note}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* subject weaknesses */}
      <div
        style={{
          background: "var(--cream)",
          border: "1px solid var(--cream-border)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: "calc(13px * var(--scale, 1))",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Subject weaknesses
          </div>
          {p2pWeaknesses.some(
            (w) => w.preScore !== null || w.postScore !== null,
          ) && (
            <button
              onClick={() => setShowP2p(!showP2p)}
              style={{
                fontSize: "calc(11px * var(--scale, 1))",
                padding: "4px 8px",
                borderRadius: "var(--radius-sm)",
                background: showP2p ? "var(--accent)" : "var(--cream-dark)",
                color: showP2p ? "#fff" : "var(--ink-muted)",
                border: "1px solid var(--cream-border)",
                cursor: "pointer",
              }}
            >
              {showP2p ? "Showing P2P" : "Show P2P"}
            </button>
          )}
        </div>

        {validWeaknesses.length === 0 ? (
          <div
            style={{
              fontSize: "calc(12px * var(--scale, 1))",
              color: "var(--ink-muted)",
              textAlign: "center",
              padding: "16px 0",
            }}
          >
            Not enough exam data to determine weaknesses yet. Take an exam!
          </div>
        ) : (
          <div className="dashboard-split-layout">
            {/* Left: Bar Chart */}
            <div className="dashboard-split-left">
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  height: 160,
                  gap: "calc(2% + 4px)",
                }}
              >
                {weaknesses.slice(0, 6).map((w) => {
                  const hasData = w.score !== null;
                  return (
                    <div
                      key={w.short}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        height: "100%",
                        opacity: hasData ? 1 : 0.3,
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          display: "flex",
                          alignItems: "flex-end",
                          width: "100%",
                          padding: "0 4px",
                          position: "relative",
                        }}
                      >
                        {/* 75% threshold line */}
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: "75%",
                            height: 1,
                            background: "var(--accent)",
                            opacity: 0.3,
                            zIndex: 0,
                          }}
                        />
                        {/* 50% threshold line */}
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            right: 0,
                            bottom: "50%",
                            height: 1,
                            background: "var(--red)",
                            opacity: 0.3,
                            zIndex: 0,
                          }}
                        />

                        {hasData && (
                          <div
                            style={{
                              width: "100%",
                              height: `${w.score}%`,
                              background:
                                w.score < 50
                                  ? "var(--red)"
                                  : w.score < 75
                                    ? "var(--accent)"
                                    : "var(--blue)",
                              borderRadius: "4px 4px 0 0",
                              transition: "height 0.5s ease",
                              zIndex: 1,
                            }}
                          />
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: "calc(10px * var(--scale, 1))",
                          fontWeight: 500,
                          color: "var(--ink)",
                          marginTop: 8,
                          textAlign: "center",
                        }}
                      >
                        {w.short}
                      </div>
                      <div
                        style={{
                          fontSize: "calc(9px * var(--scale, 1))",
                          color: "var(--ink-muted)",
                          marginTop: 2,
                        }}
                      >
                        {hasData ? `${w.score}%` : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right: Info & GWA */}
            <div
              className="dashboard-split-right"
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              {/* Top half: Horizontal GWA Bar */}
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
                    Estimated GWA
                  </span>
                  <span
                    style={{
                      fontSize: "calc(16px * var(--scale, 1))",
                      fontFamily: "var(--font-display)",
                      color:
                        totalGWA !== null && totalGWA >= 75
                          ? "var(--green)"
                          : "var(--accent)",
                    }}
                  >
                    {totalGWA !== null ? `${totalGWA}%` : "—"}
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
                  {/* 75% threshold line */}
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

                  {totalGWA !== null && (
                    <div
                      style={{
                        height: "100%",
                        width: `${totalGWA}%`,
                        background:
                          totalGWA < 75 ? "var(--accent)" : "var(--green)",
                        borderRadius: 4,
                        transition: "width 0.5s ease",
                        zIndex: 1,
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    fontSize: "calc(10px * var(--scale, 1))",
                    color: "var(--ink-faint)",
                    marginTop: 4,
                  }}
                >
                  Target: 75% to pass
                </div>
              </div>

              {/* Bottom half: Focus Area */}
              <div
                style={{
                  background:
                    lowestSubject?.score !== undefined &&
                    lowestSubject.score < 50
                      ? "var(--red-bg)"
                      : "var(--accent-bg)",
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: "calc(11px * var(--scale, 1))",
                    color:
                      lowestSubject?.score !== undefined &&
                      lowestSubject.score < 50
                        ? "var(--red)"
                        : "var(--accent)",
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
                  {showP2p
                    ? (() => {
                        const lowerCount = p2pWeaknesses.filter(
                          (w) =>
                            w.preScore !== null &&
                            w.postScore !== null &&
                            w.postScore < w.preScore,
                        ).length;
                        if (lowerCount > 0) {
                          return "You scored a lower number than your pre-exam in some subjects. Consider studying more on those.";
                        }
                        return "Great job, your post-exam scores show improvement or consistency!";
                      })()
                    : lowestSubject?.score !== undefined &&
                        lowestSubject.score < 50
                      ? `Warning: ${lowestSubject.short} is below 50%. You must review this subject to avoid failing the exam.`
                      : `Your lowest score is in ${lowestSubject?.short} (${lowestSubject?.score}%). Consider dedicating more time here.`}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* milestones */}
      <div
        style={{
          background: "var(--cream)",
          border: "1px solid var(--cream-border)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: "calc(13px * var(--scale, 1))",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: 12,
          }}
        >
          Milestones
        </div>
        <div className="dashboard-stats-grid-4" style={{ gap: 8 }}>
          {milestones.map((m) => {
            const isDateRange =
              m.dateStr.includes("-") && isNaN(Date.parse(m.dateStr));
            const days = isDateRange ? 0 : getDaysUntil(new Date(m.dateStr));
            const done = !isDateRange && days < 0;
            return (
              <div
                key={m.id}
                style={{
                  padding: "10px 12px",
                  background: done ? "var(--cream-dark)" : m.bg,
                  borderRadius: "var(--radius-sm)",
                  opacity: done ? 0.6 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: "calc(11px * var(--scale, 1))",
                    fontWeight: 500,
                    color: done ? "var(--ink-faint)" : m.color,
                    marginBottom: 4,
                  }}
                >
                  {m.label}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "calc(20px * var(--scale, 1))",
                    color: done ? "var(--ink-faint)" : m.color,
                  }}
                >
                  {isDateRange
                    ? "Ongoing"
                    : done
                      ? "✓"
                      : days === 0
                        ? "Today"
                        : `${days}d`}
                </div>
                <div
                  style={{
                    fontSize: "calc(10px * var(--scale, 1))",
                    color: done ? "var(--ink-faint)" : m.color,
                    marginTop: 2,
                    opacity: 0.8,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {isDateRange
                    ? m.dateStr
                    : new Date(m.dateStr).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                      })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* weekly overview */}
      <div
        style={{
          background: "var(--cream)",
          border: "1px solid var(--cream-border)",
          borderRadius: "var(--radius)",
          padding: "14px 16px",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: "calc(13px * var(--scale, 1))",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            {weekOffset === 0
              ? "This week"
              : weekOffset === -1
                ? "Last week"
                : weekOffset === 1
                  ? "Next week"
                  : `Week ${weekOffset > 0 ? "+" : ""}${weekOffset}`}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              style={smallBtn}
            >
              ←
            </button>
            {weekOffset !== 0 && (
              <button
                onClick={() => setWeekOffset(0)}
                style={{
                  ...smallBtn,
                  fontSize: "calc(10px * var(--scale, 1))",
                  width: 50,
                }}
              >
                Today
              </button>
            )}
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              style={smallBtn}
            >
              →
            </button>
          </div>
        </div>
        <WeeklyOverview
          weekOffset={weekOffset}
          startDateStr={startDateStr}
          subjects={subjects}
          cycleLength={cycleLength}
          studyDays={studyDays}
        />
        <div
          style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap" }}
        >
          {[
            {
              bg: "var(--blue-bg)",
              color: "var(--blue)",
              label: "Board subject",
            },
            {
              bg: "var(--green-bg)",
              color: "var(--green)",
              label: "Score: 90+",
            },
            {
              bg: "var(--blue-bg)",
              color: "var(--blue)",
              label: "Score: 75-89",
            },
          ].map((l) => (
            <div
              key={l.label}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: l.bg,
                  border: `1px solid ${l.color}`,
                }}
              />
              <span
                style={{
                  fontSize: "calc(10px * var(--scale, 1))",
                  color: "var(--ink-faint)",
                }}
              >
                {l.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const smallBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "var(--radius-sm)",
  border: "1px solid var(--cream-border)",
  background: "var(--cream)",
  cursor: "pointer",
  fontSize: "calc(12px * var(--scale, 1))",
  color: "var(--ink-muted)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "var(--font-body)",
};
