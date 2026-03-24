import { useState } from "react";
import { DEFAULT_SUBJECTS } from "./App";

export default function Onboarding({
  onComplete,
}: {
  onComplete: (
    name: string,
    subjects: typeof DEFAULT_SUBJECTS,
    cycleLength: number,
    studyDays: number[],
  ) => void;
}) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [subjects, setSubjects] = useState(DEFAULT_SUBJECTS);
  const [cycleLength, setCycleLength] = useState(6);
  const [studyDays, setStudyDays] = useState([1, 2, 3, 4, 5, 6]); // Mon-Sat

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...subjects];
    const temp = next[idx - 1];
    next[idx - 1] = next[idx];
    next[idx] = temp;
    setSubjects(next);
  }

  function moveDown(idx: number) {
    if (idx === subjects.length - 1) return;
    const next = [...subjects];
    const temp = next[idx + 1];
    next[idx + 1] = next[idx];
    next[idx] = temp;
    setSubjects(next);
  }

  function toggleDay(d: number) {
    if (studyDays.includes(d)) {
      if (studyDays.length === 1) return; // at least 1 day needed
      setStudyDays(studyDays.filter((day) => day !== d).sort());
    } else {
      setStudyDays([...studyDays, d].sort());
    }
  }

  function finish() {
    if (!name.trim()) return;
    onComplete(name.trim(), subjects, cycleLength, studyDays);
  }

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--cream)",
        color: "var(--ink)",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 32,
              lineHeight: 1.1,
              marginBottom: 8,
            }}
          >
            CBLEL Companion
          </div>
          <div style={{ fontSize: 14, color: "var(--ink-muted)" }}>
            The Licensed Librarian Roadmap
          </div>
        </div>

        {step === 1 && (
          <div
            style={{
              background: "var(--cream-dark)",
              borderRadius: "var(--radius)",
              padding: 24,
              border: "1px solid var(--cream-border)",
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Welcome, Future Librarian!
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep(2)}
              placeholder="What's your name?"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: 16,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--cream-border)",
                background: "var(--cream)",
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
                outline: "none",
                marginBottom: 16,
              }}
            />
            <button
              onClick={() => name.trim() && setStep(2)}
              disabled={!name.trim()}
              style={{
                width: "100%",
                padding: "12px",
                fontSize: 15,
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--accent)",
                color: "white",
                cursor: name.trim() ? "pointer" : "default",
                opacity: name.trim() ? 1 : 0.5,
                fontFamily: "var(--font-body)",
              }}
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div
            style={{
              background: "var(--cream-dark)",
              borderRadius: "var(--radius)",
              padding: 24,
              border: "1px solid var(--cream-border)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
              Subject Rotation
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-muted)",
                marginBottom: 20,
              }}
            >
              This app assigns one subject per week on a repeating 6-week cycle.
              Reorder them below if you prefer a different sequence.
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 24,
              }}
            >
              {subjects.map((s, i) => (
                <div
                  key={s.short}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    background: "var(--cream)",
                    border: "1px solid var(--cream-border)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "var(--accent-bg)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {s.name}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => moveUp(i)}
                      disabled={i === 0}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 4,
                        border: "1px solid var(--cream-border)",
                        background: "var(--cream-dark)",
                        color: "var(--ink)",
                        cursor: i === 0 ? "default" : "pointer",
                        opacity: i === 0 ? 0.3 : 1,
                      }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveDown(i)}
                      disabled={i === subjects.length - 1}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 4,
                        border: "1px solid var(--cream-border)",
                        background: "var(--cream-dark)",
                        color: "var(--ink)",
                        cursor:
                          i === subjects.length - 1 ? "default" : "pointer",
                        opacity: i === subjects.length - 1 ? 0.3 : 1,
                      }}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: 15,
                  fontWeight: 500,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--cream-border)",
                  background: "var(--cream)",
                  color: "var(--ink-muted)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                style={{
                  flex: 2,
                  padding: "12px",
                  fontSize: 15,
                  fontWeight: 500,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "var(--accent)",
                  color: "white",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div
            style={{
              background: "var(--cream-dark)",
              borderRadius: "var(--radius)",
              padding: 24,
              border: "1px solid var(--cream-border)",
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
              Schedule & Cycle
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--ink-muted)",
                marginBottom: 20,
              }}
            >
              Customize which days of the week you study, and how many days you
              spend on a subject before moving to the next.
            </div>

            <div style={{ marginBottom: 20 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                Study Days
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DAY_LABELS.map((label, i) => {
                  const active = studyDays.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      style={{
                        padding: "6px 10px",
                        fontSize: 12,
                        fontWeight: 500,
                        borderRadius: "var(--radius-sm)",
                        border: active
                          ? "1px solid var(--accent)"
                          : "1px solid var(--cream-border)",
                        background: active ? "var(--accent)" : "var(--cream)",
                        color: active ? "white" : "var(--ink-muted)",
                        cursor: "pointer",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--ink)",
                  marginBottom: 8,
                }}
              >
                Days per subject (Cycle Length)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={cycleLength}
                  onChange={(e) =>
                    setCycleLength(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  style={{
                    width: 80,
                    padding: "10px",
                    fontSize: 14,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--cream-border)",
                    background: "var(--cream)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-body)",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
                  days
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setStep(2)}
                style={{
                  flex: 1,
                  padding: "12px",
                  fontSize: 15,
                  fontWeight: 500,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--cream-border)",
                  background: "var(--cream)",
                  color: "var(--ink-muted)",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Back
              </button>
              <button
                onClick={finish}
                style={{
                  flex: 2,
                  padding: "12px",
                  fontSize: 15,
                  fontWeight: 500,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: "var(--accent)",
                  color: "white",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Start journey
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
