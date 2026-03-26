import { useState, useEffect } from "react";

export default function TourOverlay({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(1);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  function finish() {
    onDismiss();
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.4)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          background: "var(--cream)",
          borderRadius: "var(--radius)",
          padding: 24,
          maxWidth: 400,
          width: "100%",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          border: "1px solid var(--cream-border)",
        }}
      >
        {step === 1 && (
          <div>
            <div style={{ fontSize: 24, marginBottom: 12 }}>🗺️</div>
            <div
              style={{
                fontSize: 18,
                fontFamily: "var(--font-display)",
                marginBottom: 8,
                color: "var(--ink)",
              }}
            >
              Welcome to your roadmap
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--ink-muted)",
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              This review companion is designed to keep you focused,
              disciplined, and on track for the CBLEL. Let's take a quick tour
              of how it works.
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ fontSize: 24, marginBottom: 12 }}>📊</div>
            <div
              style={{
                fontSize: 18,
                fontFamily: "var(--font-display)",
                marginBottom: 8,
                color: "var(--ink)",
              }}
            >
              Dashboard & Progress
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--ink-muted)",
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              Your main dashboard shows your study streak, days left until the
              exam, and a heat map of your recent mock exam scores. Use it to
              gauge your momentum.
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <div style={{ fontSize: 24, marginBottom: 12 }}>✅</div>
            <div
              style={{
                fontSize: 18,
                fontFamily: "var(--font-display)",
                marginBottom: 8,
                color: "var(--ink)",
              }}
            >
              Daily Checklist
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--ink-muted)",
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              The Checklist tab automatically generates a daily routine based on
              your assigned subject for the week. This is just a
              prescription—you can remove items or add your own to fit your day.
              Complete at least 50% of the list to maintain your streak.
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <div style={{ fontSize: 24, marginBottom: 12 }}>📝</div>
            <div
              style={{
                fontSize: 18,
                fontFamily: "var(--font-display)",
                marginBottom: 8,
                color: "var(--ink)",
              }}
            >
              Mock Exams
            </div>
            <div
              style={{
                fontSize: 14,
                color: "var(--ink-muted)",
                marginBottom: 24,
                lineHeight: 1.6,
              }}
            >
              Take full timed exams or immediate-feedback sessions. To use this
              feature, upload a <strong>.txt</strong> file formatted with
              asterisks for correct answers (e.g.,{" "}
              <code
                style={{
                  background: "var(--cream-dark)",
                  padding: "2px 4px",
                  borderRadius: 3,
                  fontSize: 12,
                }}
              >
                *A. Correct Answer
              </code>
              ).
            </div>
          </div>
        )}

        {/* Dots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginBottom: 24,
          }}
        >
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background:
                  step === s ? "var(--accent)" : "var(--cream-border)",
                transition: "background 0.2s",
              }}
            />
          ))}
        </div>

        {/* Nav */}
        <div style={{ display: "flex", gap: 12 }}>
          {step > 1 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={{
                flex: 1,
                padding: "10px",
                fontSize: 14,
                fontWeight: 500,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--cream-border)",
                background: "var(--cream-dark)",
                color: "var(--ink-muted)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={() => (step < 4 ? setStep((s) => s + 1) : finish())}
            style={{
              flex: 2,
              padding: "10px",
              fontSize: 14,
              fontWeight: 500,
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--accent)",
              color: "white",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            {step < 4 ? "Next" : "Get started"}
          </button>
        </div>
      </div>
    </div>
  );
}
