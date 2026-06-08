import React, { useState, useEffect, useRef } from "react";
import { generateQuestion, StudyQuestion } from "./StudyGenerator";
import { BookOpen, X } from "lucide-react";
import { loadJSON, saveJSON } from "../utils/storage";

const COMPLIMENTS = [
  "Nice!",
  "Keep it up!",
  "You're on fire!",
  "Amazing!",
  "Unstoppable!",
];

const Particles: React.FC<{ color: string; count: number }> = ({
  color,
  count,
}) => {
  const [particles, setParticles] = useState<
    { id: number; tx: string; ty: string; size: number; duration: number }[]
  >([]);

  useEffect(() => {
    const newParticles = Array.from({ length: count }).map((_, i) => {
      const angle = Math.random() * Math.PI * 2;
      const distance = 80 + Math.random() * 170;
      return {
        id: i,
        tx: `${Math.cos(angle) * distance}px`,
        ty: `${Math.sin(angle) * distance}px`,
        size: 4 + Math.random() * 8,
        duration: 0.6 + Math.random() * 1.5,
      };
    });
    setParticles(newParticles);
  }, [count]);

  return (
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={
            {
              left: "50%",
              top: "50%",
              width: p.size,
              height: p.size,
              background: color,
              boxShadow: `0 0 10px ${color}`,
              animationDuration: `${p.duration}s`,
              zIndex: -2,
              "--tx": p.tx,
              "--ty": p.ty,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
};

interface StudyFeedProps {
  onAnswer: (correct: boolean) => void;
  studyStreak: number;
  enableStreak: boolean;
  onClose: () => void;
}

export const StudyFeed: React.FC<StudyFeedProps> = ({
  onAnswer,
  studyStreak,
  enableStreak,
  onClose,
}) => {
  const prevStreakRef = useRef(studyStreak);
  const [dyingStreak, setDyingStreak] = useState<{
    score: number;
    color: string;
    compliment: string | null;
  } | null>(null);

  const [questions, setQuestions] = useState<StudyQuestion[]>(() => {
    const raw = loadJSON<StudyQuestion[]>("studyFeedQuestions", []);
    if (raw.length > 10) {
      return raw.slice(-10);
    }
    return raw;
  });
  const [loading, setLoading] = useState(questions.length === 0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const rawQuestions = loadJSON<StudyQuestion[]>("studyFeedQuestions", []);
    const rawIndex = loadJSON<number>("studyFeedActiveIndex", 0);
    if (rawQuestions.length > 10) {
      const removedCount = rawQuestions.length - 10;
      return Math.max(0, rawIndex - removedCount);
    }
    return rawIndex;
  });

  useEffect(() => {
    async function init() {
      if (questions.length === 0) {
        const q1 = await generateQuestion();
        const q2 = await generateQuestion();
        const q3 = await generateQuestion();
        const initial = [q1, q2, q3];
        setQuestions(initial);
        saveJSON("studyFeedQuestions", initial);
        setLoading(false);
      }
    }
    init();
  }, [questions.length]);

  // Restore scroll position on mount after a tiny delay to let the DOM paint
  useEffect(() => {
    if (!loading && containerRef.current && activeIndex > 0) {
      setTimeout(() => {
        if (containerRef.current) {
          const el = containerRef.current;
          const items = el.querySelectorAll(".study-feed-item");
          if (activeIndex < items.length) {
            const item = items[activeIndex] as HTMLElement;
            const targetScroll =
              item.offsetTop - (el.clientHeight - item.clientHeight) / 2;
            el.scrollTo({ top: targetScroll, behavior: "instant" });
          }
        }
      }, 50);
    }
  }, [loading]);

  const loadingMoreRef = useRef(false);

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;

    // Find the item closest to the center of the scroll container
    const containerCenter = el.scrollTop + el.clientHeight / 2;
    let closestIndex = 0;
    let minDistance = Infinity;

    Array.from(el.children).forEach((child, index) => {
      const htmlChild = child as HTMLElement;
      if (htmlChild.classList.contains("study-feed-item")) {
        const childCenter = htmlChild.offsetTop + htmlChild.clientHeight / 2;
        const distance = Math.abs(containerCenter - childCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      }
    });

    if (closestIndex !== activeIndex) {
      if (closestIndex > activeIndex) {
        const prevQuestion = questions[activeIndex];
        if (prevQuestion && !prevQuestion.answeredLetter) {
          onAnswer(false);
        }
      }

      setActiveIndex(closestIndex);
      saveJSON("studyFeedActiveIndex", closestIndex);
    }

    if (closestIndex >= questions.length - 2 && !loadingMoreRef.current) {
      loadingMoreRef.current = true;
      const q = await generateQuestion();

      setQuestions((prev) => {
        const next = [...prev, q];
        saveJSON("studyFeedQuestions", next);
        return next;
      });
      loadingMoreRef.current = false;
    }
  };

  const handleItemAnswer = (idx: number, letter: string, correct: boolean) => {
    setQuestions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], answeredLetter: letter };
      saveJSON("studyFeedQuestions", next);
      return next;
    });
    onAnswer(correct);
  };

  const [compliment, setCompliment] = useState<string | null>(null);

  useEffect(() => {
    if (studyStreak === 0 && prevStreakRef.current > 0) {
      setDyingStreak({
        score: prevStreakRef.current,
        color: getStreakColor(prevStreakRef.current) || "var(--sienna)",
        compliment,
      });
      setTimeout(() => setDyingStreak(null), 600);
    }
    prevStreakRef.current = studyStreak;

    if (enableStreak && studyStreak > 0 && studyStreak % 10 === 0) {
      setCompliment(
        COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)],
      );
    } else if (studyStreak === 0) {
      setCompliment(null);
    }
  }, [studyStreak, enableStreak, compliment]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
          color: "var(--ink-muted)",
        }}
      >
        Loading Feed...
      </div>
    );
  }

  const streakColor = getStreakColor(studyStreak) || "var(--sienna)";
  const blobDuration =
    Math.max(2, 6 - Math.floor(studyStreak / 10) * 0.5) + "s";

  const blobStyle = {
    "--blob-color": streakColor,
    animationDuration: blobDuration,
  } as React.CSSProperties;

  return (
    <div className="desktop-study-layout">
      {/* Absolute Close Button for Desktop */}
      <button
        className="study-close-btn"
        onClick={onClose}
        title="Exit Study Mode"
      >
        <X size={24} />
      </button>

      {/* Left Column: Animated Streak Blob */}
      <div className="study-side-col study-side-left">
        {enableStreak && (studyStreak > 0 || dyingStreak) && (
          <div
            className={`streak-blob-container ${dyingStreak ? "fade-out-down" : "fade-in"}`}
          >
            <div
              className="streak-blob"
              style={
                dyingStreak
                  ? ({
                      "--blob-color": dyingStreak.color,
                      animationDuration: "8s",
                    } as React.CSSProperties)
                  : blobStyle
              }
            />
            <div className="streak-blob-number">
              {dyingStreak ? dyingStreak.score : studyStreak}
            </div>
          </div>
        )}
      </div>

      {/* Center Column: Feed */}
      <div className="study-center-col">
        <div
          className="study-feed-container"
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            height: "100%",
            width: "100%",
            maxWidth: "450px",
            background: "transparent",
            overflowY: "scroll",
            overflowX: "hidden",
            scrollSnapType: "y mandatory",
            scrollBehavior: "smooth",
            position: "relative",
            paddingTop: "10vh",
            paddingBottom: "10vh",
            display: "flex",
            flexDirection: "column",
            gap: "2vh",
          }}
        >
          {questions.map((q, idx) => (
            <StudyItem
              key={`${idx}-${q.stem.slice(0, 10)}`}
              question={q}
              isActive={idx === activeIndex}
              onAnswer={(letter, correct) =>
                handleItemAnswer(idx, letter, correct)
              }
              studyStreak={studyStreak}
              enableStreak={enableStreak}
            />
          ))}
        </div>
      </div>

      {/* Right Column: Compliment */}
      <div className="study-side-col study-side-right">
        {enableStreak &&
          (compliment || (dyingStreak && dyingStreak.compliment)) && (
            <div
              key={dyingStreak ? "dying" : compliment} // Force re-render if dying
              className={`study-compliment-text ${dyingStreak ? "fade-out-down" : "fade-in"}`}
              style={{ color: dyingStreak ? dyingStreak.color : streakColor }}
            >
              {dyingStreak ? dyingStreak.compliment : compliment}
            </div>
          )}
      </div>
    </div>
  );
};

interface StudyItemProps {
  question: StudyQuestion;
  isActive: boolean;
  onAnswer: (letter: string, correct: boolean) => void;
  studyStreak: number;
  enableStreak: boolean;
}

const streakColors10to100 = [
  "#22C55E", // 10
  "#84CC16", // 20
  "#C9D61A", // 30
  "#FBBF24", // 40
  "#F97316", // 50
  "#EA580C", // 60
  "#E14A12", // 70
  "#DC3A16", // 80
  "#D73218", // 90
  "#D12B1A", // 100
];

const streakColors100to1000 = [
  "#D12B1A", // 100
  "#C62828", // 200
  "#AD2E6C", // 300
  "#8E44AD", // 400
  "#6C5CE7", // 500
  "#4C6EF5", // 600
  "#3B82F6", // 700
  "#2563EB", // 800
  "#1D4ED8", // 900
  "#1E40AF", // 1000
];

function getStreakColor(streak: number): string | null {
  if (streak < 10) return null;
  if (streak <= 100) {
    const idx = Math.floor(streak / 10) - 1;
    return streakColors10to100[Math.min(idx, 9)];
  }
  const idx = Math.floor(streak / 100) - 1;
  return streakColors100to1000[Math.min(idx, 9)];
}

const StudyItem: React.FC<StudyItemProps> = ({
  question,
  isActive,
  onAnswer,
  studyStreak,
  enableStreak,
}) => {
  const selectedLetter = question.answeredLetter || null;
  const correctOpt = question.options.find((o: any) => o.correct);
  const isCorrect = selectedLetter === correctOpt?.letter;
  const [showShine, setShowShine] = useState(false);

  const handleSelect = (letter: string) => {
    if (selectedLetter) return;

    const correct = letter === correctOpt?.letter;

    onAnswer(letter, correct);

    if (correct) {
      const nextStreak = studyStreak + 1;
      const willBeCheckpoint =
        enableStreak &&
        nextStreak >= 10 &&
        ((nextStreak <= 100 && nextStreak % 10 === 0) ||
          (nextStreak > 100 && nextStreak % 100 === 0));

      if (willBeCheckpoint) {
        setShowShine(true);
        setTimeout(() => setShowShine(false), 2000);
      }
    }
  };

  const isDDC = question.classificationType === "DDC";
  const isLCC = question.classificationType === "LCC";
  const isMARC = question.classificationType === "MARC";
  const isClassification = question.type === "classification";

  const nextStreak = isCorrect ? studyStreak : studyStreak;
  const showStreakEffects = enableStreak && nextStreak >= 10;
  const streakColor = showStreakEffects ? getStreakColor(nextStreak) : null;

  return (
    <div
      className={`study-feed-item`}
      style={
        {
          height: "75vh",
          width: "90%",
          margin: "0 auto",
          flexShrink: 0,
          scrollSnapAlign: "center",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "24px",
          position: "relative",
          background: "var(--cream)",
          borderRadius: "24px",
          boxShadow: isActive
            ? streakColor
              ? `0 10px 50px ${streakColor}40`
              : "0 10px 40px rgba(0,0,0,0.12)"
            : "0 4px 12px rgba(0,0,0,0.05)",
          transform: isActive ? "scale(1)" : "scale(0.95)",
          opacity: isActive ? 1 : 0.75,
          transition:
            "background 0.5s ease-in-out, box-shadow 0.5s ease-in-out, transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
          ...(streakColor ? { "--glow-color": streakColor } : {}),
        } as React.CSSProperties
      }
    >
      {/* Dynamic Animated Shine Outline */}
      {streakColor && (
        <div className={`anim-shine ${showShine ? "active" : ""}`} />
      )}

      {/* Background Gradient Effect for streaks */}
      {isActive && streakColor && (
        <>
          <div
            className="anim-breathe"
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "150%",
              height: "150%",
              background: `radial-gradient(circle, ${streakColor}25 0%, transparent 60%)`,
              pointerEvents: "none",
              zIndex: -1,
              borderRadius: "50%",
              transition: "background 0.5s ease-in-out",
            }}
          />
          <Particles
            color={streakColor}
            count={Math.min(50, Math.floor(nextStreak / 2))}
          />
        </>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
        }}
      >
        <div style={{ margin: "auto 0", width: "100%" }}>
          {/* Topic Tag */}
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--accent)",
            }}
          >
            <BookOpen size={16} />
            <span
              style={{
                fontSize: "calc(13px * var(--scale, 1))",
                fontWeight: 500,
              }}
            >
              {isClassification
                ? isDDC
                  ? "DDC Practice"
                  : isLCC
                    ? "LCC Practice"
                    : "MARC Practice"
                : `Subject: ${question.subject}`}
            </span>
          </div>

          {/* Question Stem */}
          <div
            style={{
              fontSize: isClassification
                ? "calc(24px * var(--scale, 1))"
                : "calc(20px * var(--scale, 1))",
              fontFamily: "var(--font-display)",
              color: "var(--ink)",
              textAlign: isClassification ? "center" : "left",
              marginBottom: 32,
              lineHeight: 1.3,
            }}
          >
            {question.stem}
          </div>

          {/* Options */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {question.options.map((opt: any) => {
              const isSelected = selectedLetter === opt.letter;
              const isActualCorrect = opt.correct;

              let bg = "var(--cream-dark)";
              let border = "1px solid var(--cream-border)";
              let color = "var(--ink)";

              if (selectedLetter) {
                if (isActualCorrect) {
                  bg = "var(--green-bg)";
                  border = "1px solid var(--green)";
                  color = "var(--green)";
                } else if (isSelected && !isActualCorrect) {
                  bg = "var(--red-bg)";
                  border = "1px solid var(--red)";
                  color = "var(--red)";
                } else {
                  color = "var(--ink-faint)";
                }
              }

              return (
                <button
                  key={opt.letter}
                  onClick={() => handleSelect(opt.letter)}
                  disabled={!!selectedLetter}
                  style={{
                    padding: "16px",
                    borderRadius: "var(--radius)",
                    background: bg,
                    border: border,
                    color: color,
                    fontSize: isClassification
                      ? "calc(18px * var(--scale, 1))"
                      : "calc(16px * var(--scale, 1))",
                    textAlign: isClassification ? "center" : "left",
                    cursor: selectedLetter ? "default" : "pointer",
                    transition: "all 0.2s",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {!isClassification && (
                    <span style={{ fontWeight: 500, marginRight: 8 }}>
                      {opt.letter}.
                    </span>
                  )}
                  {opt.text}
                </button>
              );
            })}
          </div>

          {/* Explanation */}
          {selectedLetter && !isCorrect && question.explanation && (
            <div
              style={{
                marginTop: 24,
                padding: "16px",
                background: "var(--accent-bg)",
                borderRadius: "var(--radius)",
                borderLeft: "3px solid var(--accent)",
                animation: "fadeIn 0.3s ease-out",
              }}
            >
              <div
                style={{
                  fontSize: "calc(12px * var(--scale, 1))",
                  color: "var(--ink-muted)",
                  marginBottom: 4,
                  fontWeight: 500,
                }}
              >
                Explanation
              </div>
              <div
                style={{
                  fontSize: "calc(14px * var(--scale, 1))",
                  color: "var(--ink)",
                }}
              >
                {question.explanation}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scroll Hint */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: 0,
          right: 0,
          textAlign: "center",
          color: "var(--ink-faint)",
          fontSize: "calc(12px * var(--scale, 1))",
          opacity: selectedLetter ? 1 : 0.5,
          transition: "opacity 0.3s",
        }}
      >
        Swipe up for next
      </div>
    </div>
  );
};
