import { useState, useEffect, useRef } from "react";

type TimerMode = "work" | "break";
const WORK_MIN = 25;
const BREAK_MIN = 5;

export default function Pomodoro() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<TimerMode>("work");
  const [timeLeft, setTimeLeft] = useState(WORK_MIN * 60);
  const [isRunning, setIsRunning] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // switch mode
            const nextMode = mode === "work" ? "break" : "work";
            setMode(nextMode);
            return nextMode === "work" ? WORK_MIN * 60 : BREAK_MIN * 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode]);

  function toggle() {
    setIsRunning((r) => !r);
  }

  function reset() {
    setIsRunning(false);
    setMode("work");
    setTimeLeft(WORK_MIN * 60);
  }

  function skip() {
    const nextMode = mode === "work" ? "break" : "work";
    setMode(nextMode);
    setTimeLeft(nextMode === "work" ? WORK_MIN * 60 : BREAK_MIN * 60);
    setIsRunning(false);
  }

  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const timeStr = `${m}:${String(s).padStart(2, "0")}`;
  const progress =
    mode === "work"
      ? 1 - timeLeft / (WORK_MIN * 60)
      : 1 - timeLeft / (BREAK_MIN * 60);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 9000,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 12,
      }}
    >
      {open && (
        <div
          style={{
            background: "var(--cream)",
            border: "1px solid var(--cream-border)",
            borderRadius: "var(--radius)",
            padding: "20px 24px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
            width: 260,
            animation: "slideUp 0.2s ease-out",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
              Pomodoro Timer
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "var(--ink-faint)",
                cursor: "pointer",
                fontSize: 20,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button
              onClick={() => {
                setMode("work");
                setTimeLeft(WORK_MIN * 60);
                setIsRunning(false);
              }}
              style={{
                flex: 1,
                padding: "6px",
                fontSize: 12,
                fontWeight: 500,
                border: "none",
                borderRadius: "var(--radius-sm)",
                background:
                  mode === "work" ? "var(--accent)" : "var(--cream-dark)",
                color: mode === "work" ? "white" : "var(--ink-muted)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Focus
            </button>
            <button
              onClick={() => {
                setMode("break");
                setTimeLeft(BREAK_MIN * 60);
                setIsRunning(false);
              }}
              style={{
                flex: 1,
                padding: "6px",
                fontSize: 12,
                fontWeight: 500,
                border: "none",
                borderRadius: "var(--radius-sm)",
                background:
                  mode === "break" ? "var(--green)" : "var(--cream-dark)",
                color: mode === "break" ? "white" : "var(--ink-muted)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              Break
            </button>
          </div>

          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 48,
                color: "var(--ink)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {timeStr}
            </div>
          </div>

          <div
            style={{
              height: 4,
              background: "var(--cream-border)",
              borderRadius: 2,
              marginBottom: 20,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progress * 100}%`,
                background: mode === "work" ? "var(--accent)" : "var(--green)",
                borderRadius: 2,
                transition: "width 1s linear",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={reset}
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--cream-border)",
                background: "var(--cream-dark)",
                color: "var(--ink-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              onClick={toggle}
              style={{
                flex: 1,
                height: 36,
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--ink)",
                color: "var(--cream)",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {isRunning ? "Pause" : "Start"}
            </button>
            <button
              onClick={skip}
              style={{
                width: 36,
                height: 36,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--cream-border)",
                background: "var(--cream-dark)",
                color: "var(--ink-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 4l10 8-10 8V4z" />
                <path d="M19 5v14" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            height: 44,
            padding: "0 16px",
            borderRadius: 22,
            background: isRunning
              ? mode === "work"
                ? "var(--accent)"
                : "var(--green)"
              : "var(--cream)",
            border: isRunning ? "none" : "1px solid var(--cream-border)",
            color: isRunning ? "white" : "var(--ink)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            fontWeight: 500,
            transition: "all 0.2s",
          }}
        >
          <span style={{ fontSize: 16 }}>⏱</span>
          {isRunning ? timeStr : "Pomodoro"}
        </button>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `,
        }}
      />
    </div>
  );
}
