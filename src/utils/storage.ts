export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, val: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

export function updateRecentlySeenQuestions(stems: string[]) {
  const MAX_HISTORY = 200;
  try {
    let recent = loadJSON<string[]>("recentlySeenQuestions", []);
    // Prepend new stems
    recent = [...stems, ...recent];
    // Keep unique
    recent = Array.from(new Set(recent));
    // Trim
    if (recent.length > MAX_HISTORY) {
      recent = recent.slice(0, MAX_HISTORY);
    }
    saveJSON("recentlySeenQuestions", recent);
  } catch {}
}
