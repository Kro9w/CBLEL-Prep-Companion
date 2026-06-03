import React, { useState } from "react";
import packageJson from "../../package.json";

export const SettingsPage: React.FC<{
  updateAvailable: boolean;
  latestRelease: any;
  onOpenUpdateModal: () => void;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  simpleFont: boolean;
  setSimpleFont: (val: boolean) => void;
  fontSize: "S" | "M" | "L";
  setFontSize: (val: "S" | "M" | "L") => void;
  enableStreak: boolean;
  setEnableStreak: (val: boolean) => void;
  enablePomodoro: boolean;
  setEnablePomodoro: (val: boolean) => void;
}> = ({
  updateAvailable,
  latestRelease,
  onOpenUpdateModal,
  darkMode,
  setDarkMode,
  simpleFont,
  setSimpleFont,
  fontSize,
  setFontSize,
  enableStreak,
  setEnableStreak,
  enablePomodoro,
  setEnablePomodoro,
}) => {
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  const handleManualCheck = async () => {
    // If we already know an update is available via App context, just open the modal.
    if (updateAvailable) {
      onOpenUpdateModal();
      return;
    }

    setIsCheckingUpdate(true);
    setUpdateMessage(null);
    try {
      const response = await fetch(
        "https://api.github.com/repos/Kro9w/CBLEL-Prep-Companion/releases/latest",
      );
      if (!response.ok) throw new Error("Failed to fetch latest release");
      const data = await response.json();

      const current = packageJson.version;
      const remote = data.tag_name.replace(/^v/, "");

      const currentParts = current.split(".").map(Number);
      const remoteParts = remote.split(".").map(Number);

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
        setUpdateMessage(`Update available: ${data.tag_name}`);
        // We trigger a full reload so App.tsx can mount the modal natively,
        // or they can just restart the app. The modal relies on App state,
        // so setting it here would require a callback.
        // Since we already pass down `updateAvailable`, if they were online, it would be true.
        // Let's just instruct them:
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setUpdateMessage("You are on the latest version.");
      }
    } catch (e) {
      setUpdateMessage("Failed to check for updates.");
    } finally {
      setIsCheckingUpdate(false);
      setTimeout(() => setUpdateMessage(null), 4000);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "calc(24px * var(--scale, 1))",
          color: "var(--ink)",
        }}
      >
        Settings
      </h2>

      {/* Theme Toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px",
          background: "var(--cream-dark)",
          borderRadius: "var(--radius)",
        }}
      >
        <span
          style={{
            fontSize: "calc(16px * var(--scale, 1))",
            fontWeight: 500,
            color: "var(--ink)",
          }}
        >
          Dark Mode
        </span>
        <button
          onClick={() => setDarkMode(!darkMode)}
          style={{
            width: 50,
            height: 28,
            borderRadius: 14,
            background: darkMode ? "var(--accent)" : "var(--cream-border)",
            border: "none",
            position: "relative",
            cursor: "pointer",
            transition: "background 0.2s",
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: "var(--cream)",
              position: "absolute",
              top: 4,
              left: darkMode ? 26 : 4,
              transition: "left 0.2s",
            }}
          />
        </button>
      </div>

      {/* Font Style */}
      <div
        style={{
          padding: "16px",
          background: "var(--cream-dark)",
          borderRadius: "var(--radius)",
        }}
      >
        <div
          style={{
            fontSize: "calc(14px * var(--scale, 1))",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: 12,
          }}
        >
          Font Style
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => setSimpleFont(false)}
            style={{
              flex: 1,
              padding: "12px",
              fontSize: "calc(16px * var(--scale, 1))",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--cream-border)",
              background: !simpleFont ? "var(--accent-bg)" : "var(--cream)",
              color: !simpleFont ? "var(--accent)" : "var(--ink-muted)",
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
              padding: "12px",
              fontSize: "calc(16px * var(--scale, 1))",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--cream-border)",
              background: simpleFont ? "var(--accent-bg)" : "var(--cream)",
              color: simpleFont ? "var(--accent)" : "var(--ink-muted)",
              fontFamily: "'Fraunces', Georgia, serif",
              cursor: "pointer",
            }}
          >
            Fraunces
          </button>
        </div>
      </div>

      {/* Gamification & Timer Settings */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          padding: "16px",
          background: "var(--cream-dark)",
          borderRadius: "var(--radius)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: "calc(16px * var(--scale, 1))",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Study Cards Streak
          </span>
          <button
            onClick={() => setEnableStreak(!enableStreak)}
            style={{
              width: 50,
              height: 28,
              borderRadius: 14,
              background: enableStreak
                ? "var(--accent)"
                : "var(--cream-border)",
              border: "none",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "var(--cream)",
                position: "absolute",
                top: 4,
                left: enableStreak ? 26 : 4,
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span
            style={{
              fontSize: "calc(16px * var(--scale, 1))",
              fontWeight: 500,
              color: "var(--ink)",
            }}
          >
            Pomodoro Timer
          </span>
          <button
            onClick={() => setEnablePomodoro(!enablePomodoro)}
            style={{
              width: 50,
              height: 28,
              borderRadius: 14,
              background: enablePomodoro
                ? "var(--accent)"
                : "var(--cream-border)",
              border: "none",
              position: "relative",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "var(--cream)",
                position: "absolute",
                top: 4,
                left: enablePomodoro ? 26 : 4,
                transition: "left 0.2s",
              }}
            />
          </button>
        </div>
      </div>

      {/* App Info & Updates */}
      <div
        style={{
          padding: "16px",
          background: "var(--cream-dark)",
          borderRadius: "var(--radius)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "calc(16px * var(--scale, 1))",
                fontWeight: 500,
                color: "var(--ink)",
              }}
            >
              App Version
            </div>
            <div
              style={{
                fontSize: "calc(13px * var(--scale, 1))",
                color: "var(--ink-muted)",
                marginTop: 2,
              }}
            >
              v{packageJson.version}
            </div>
          </div>
          <button
            onClick={handleManualCheck}
            disabled={isCheckingUpdate}
            style={{
              padding: "8px 12px",
              fontSize: "calc(13px * var(--scale, 1))",
              borderRadius: "var(--radius-sm)",
              border: updateAvailable
                ? "none"
                : "1px solid var(--cream-border)",
              background: updateAvailable ? "var(--accent)" : "var(--cream)",
              color: updateAvailable ? "white" : "var(--ink)",
              cursor: isCheckingUpdate ? "not-allowed" : "pointer",
              fontFamily: "var(--font-body)",
              opacity: isCheckingUpdate ? 0.7 : 1,
            }}
          >
            {isCheckingUpdate
              ? "Checking..."
              : updateAvailable
                ? "Update Available"
                : "Check for Updates"}
          </button>
        </div>
        {updateMessage && !updateAvailable && (
          <div
            style={{
              fontSize: "calc(13px * var(--scale, 1))",
              color: updateMessage.includes("Update available")
                ? "var(--accent)"
                : "var(--ink-muted)",
              marginTop: 4,
            }}
          >
            {updateMessage}
          </div>
        )}
      </div>

      {/* Font Size */}
      <div
        style={{
          padding: "16px",
          background: "var(--cream-dark)",
          borderRadius: "var(--radius)",
        }}
      >
        <div
          style={{
            fontSize: "calc(14px * var(--scale, 1))",
            fontWeight: 500,
            color: "var(--ink)",
            marginBottom: 12,
          }}
        >
          Text Size
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {(["S", "M", "L"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFontSize(s)}
              style={{
                flex: 1,
                padding: "12px",
                fontSize: `calc(${s === "S" ? 14 : s === "M" ? 16 : 18}px * var(--scale, 1))`,
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--cream-border)",
                background:
                  fontSize === s ? "var(--accent-bg)" : "var(--cream)",
                color: fontSize === s ? "var(--accent)" : "var(--ink-muted)",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
