import React, { useState } from "react";

export const AutoUpdater: React.FC<{
  show: boolean;
  latestRelease: any;
  onClose: () => void;
}> = ({ show, latestRelease, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!show || !latestRelease) return null;

  const getPlatformExtension = () => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("android")) return ".apk";
    if (ua.includes("win")) return ".exe";
    if (ua.includes("mac")) return ".dmg";
    return null; // fallback or unknown
  };

  const handleUpdate = () => {
    setIsDownloading(true);

    const remoteVersion = latestRelease.tag_name.replace(/^v/, "");
    const ext = getPlatformExtension();
    const expectedFilename = ext ? `Solari_${remoteVersion}${ext}` : null;

    let downloadUrl = latestRelease.html_url; // fallback

    if (
      expectedFilename &&
      latestRelease.assets &&
      latestRelease.assets.length > 0
    ) {
      const asset = latestRelease.assets.find(
        (a: any) => a.name === expectedFilename,
      );
      if (asset) {
        downloadUrl = asset.browser_download_url;
      }
    }

    // Open download link or release page
    window.open(downloadUrl, "_blank");

    // Provide a small delay before closing to show the "Downloading..." state
    setTimeout(() => {
      setIsDownloading(false);
      onClose();
    }, 2000);
  };

  return (
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
          maxWidth: "340px",
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.15)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          animation: "fade-in 0.2s ease-out",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "calc(22px * var(--scale, 1))",
              color: "var(--ink)",
              marginBottom: "8px",
            }}
          >
            Update Available
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "calc(14px * var(--scale, 1))",
              color: "var(--ink-muted)",
              lineHeight: 1.5,
            }}
          >
            A new version of Solari ({latestRelease.tag_name}) is ready to
            download.
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
          <button
            onClick={onClose}
            disabled={isDownloading}
            style={{
              flex: 1,
              padding: "10px",
              background: "var(--cream-dark)",
              border: "1px solid var(--cream-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--ink-muted)",
              fontSize: "calc(14px * var(--scale, 1))",
              fontFamily: "var(--font-body)",
              cursor: isDownloading ? "not-allowed" : "pointer",
              opacity: isDownloading ? 0.6 : 1,
            }}
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            disabled={isDownloading}
            style={{
              flex: 1,
              padding: "10px",
              background: isDownloading ? "var(--green)" : "var(--accent)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              color: "white",
              fontSize: "calc(14px * var(--scale, 1))",
              fontFamily: "var(--font-body)",
              cursor: isDownloading ? "wait" : "pointer",
              fontWeight: 500,
              transition: "background 0.2s",
            }}
          >
            {isDownloading ? "Downloading..." : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
};
