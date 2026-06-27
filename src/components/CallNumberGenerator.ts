// --- Call Number Generator & Sorting Logic ---

/**
 * Normalizes DDC strings for strict sorting.
 * Rules:
 * 1. Class number (e.g., 301.01) is sorted numerically.
 * 2. Cutter is sorted alphabetically, then numerically (treating numbers as decimals if standard DDC rules apply, but usually just direct string compare works for basic Cutters if padded).
 * 3. Year/Edition is sorted numerically.
 * 4. Volume/Copy is sorted alphanumerically.
 */
export function sortDDC(callNumbers: string[]): string[] {
  return [...callNumbers].sort((a, b) => {
    // Basic DDC normalization: pad the class number so standard string comparison works.
    // e.g., "301 M11s 1995" -> parts: class="301", rest="M11s 1995"
    const parse = (c: string) => {
      const parts = c.trim().split(/\s+/);
      const classNum = parts[0];
      const rest = parts.slice(1).join(" ");
      return { classNum: parseFloat(classNum), rest };
    };

    const pA = parse(a);
    const pB = parse(b);

    if (pA.classNum !== pB.classNum) {
      return pA.classNum - pB.classNum;
    }
    
    // Fallback to strict string comparison for the rest (Cutters, dates)
    // In DDC, space before Cutter vs no space, etc., can be tricky, but basic localeCompare works well for standard formats.
    return pA.rest.localeCompare(pB.rest);
  });
}

/**
 * Normalizes LCC strings for strict sorting.
 * Rules:
 * 1. Letters (Class) sorted alphabetically.
 * 2. Whole numbers sorted numerically.
 * 3. Decimals sorted numerically.
 * 4. First Cutter: Letter alphabetically, number as a DECIMAL.
 * 5. Second Cutter: Letter alphabetically, number as a DECIMAL.
 * 6. Date sorted numerically.
 */
export function sortLCC(callNumbers: string[]): string[] {
  return [...callNumbers].sort((a, b) => {
    const parse = (c: string) => {
      // Very basic LCC parsing for sorting purposes.
      // E.g., "KF 4550.Z9 .B37 1999" -> Letters: KF, Num: 4550, Dec: .Z9, Cutters: .B37, Year: 1999
      // Pad letters
      const letters = (c.match(/^[A-Z]+/) || [""])[0];
      const numMatch = c.match(/^[A-Z]+\s*(\d+(?:\.\d+)?)/);
      const num = numMatch ? parseFloat(numMatch[1]) : 0;
      
      // Extract everything after the class/number
      const rest = c.replace(/^[A-Z]+\s*\d+(?:\.\d+)?/, "").trim();
      return { letters, num, rest };
    };

    const pA = parse(a);
    const pB = parse(b);

    if (pA.letters !== pB.letters) {
      return pA.letters.localeCompare(pB.letters);
    }
    if (pA.num !== pB.num) {
      return pA.num - pB.num;
    }
    
    // Compare rest (Cutters, Dates)
    // Real LCC sorting treats Cutter numbers as decimals (e.g. .B37 comes BEFORE .B4).
    // To handle this simply, we pad digits in the rest string.
    const padDecimals = (str: string) => {
      return str.replace(/([A-Z])(\d+)/g, (match, letter, digits) => {
        // Pad the digits to act like decimals: '37' -> '37000', '4' -> '40000'
        return letter + String(digits).padEnd(5, '0');
      });
    };
    
    return padDecimals(pA.rest).localeCompare(padDecimals(pB.rest));
  });
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomLetter() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return letters.charAt(getRandomInt(0, 25));
}

export function generateVariations(seed: string, count: number, type: "DDC" | "LCC"): string[] {
  const results = new Set<string>();
  results.add(seed.trim());

  // We loop until we have enough unique variations
  let attempts = 0;
  while (results.size < count && attempts < 100) {
    attempts++;
    let variant = seed.trim();

    if (type === "DDC") {
      const parts = variant.split(/\s+/);
      const classNum = parts[0];
      const rest = parts.slice(1).join(" ");
      
      const r = Math.random();
      if (r < 0.25 && !classNum.includes(".")) {
        // Add a decimal
        variant = `${classNum}.${getRandomInt(1, 9)} ${rest}`;
      } else if (r < 0.5 && classNum.includes(".")) {
        // Extend the decimal
        variant = `${classNum}${getRandomInt(1, 9)} ${rest}`;
      } else if (r < 0.75) {
        // Modify the Cutter slightly
        const cutterMatch = rest.match(/^[A-Z]\d+[a-z]?/);
        if (cutterMatch) {
          const cutter = cutterMatch[0];
          const newCutter = cutter + getRandomInt(2, 5); // e.g. M11s -> M11s2
          variant = `${classNum} ${rest.replace(cutter, newCutter)}`;
        }
      } else {
        // Add a date
        const hasDate = /\d{4}$/.test(rest);
        if (!hasDate) {
          variant = `${variant} ${getRandomInt(1980, 2024)}`;
        } else {
           variant = variant.replace(/\d{4}$/, String(getRandomInt(1980, 2024)));
        }
      }
    } else {
      // LCC Variations
      const r = Math.random();
      if (r < 0.33) {
        // Tweak the main number
        const numMatch = variant.match(/^([A-Z]+\s*)(\d+)/);
        if (numMatch) {
           variant = variant.replace(numMatch[0], `${numMatch[1]}${parseInt(numMatch[2]) + getRandomInt(-2, 2)}`);
        }
      } else if (r < 0.66) {
        // Modify Cutter (add/change a digit to test decimal treatment)
        const cutterMatch = variant.match(/\.[A-Z](\d+)/);
        if (cutterMatch) {
           // LCC cutters are decimals. E.g., .B37. Let's make .B372 or .B36
           variant = variant.replace(cutterMatch[0], `${cutterMatch[0]}${getRandomInt(1, 9)}`);
        }
      } else {
         // Add a date
        const hasDate = /\d{4}$/.test(variant);
        if (!hasDate) {
          variant = `${variant} ${getRandomInt(1980, 2024)}`;
        } else {
           variant = variant.replace(/\d{4}$/, String(getRandomInt(1980, 2024)));
        }
      }
    }
    
    // Clean up double spaces
    variant = variant.replace(/\s+/g, ' ').trim();
    if (variant !== seed.trim()) {
      results.add(variant);
    }
  }
  
  const finalArray = Array.from(results).slice(0, count);
  // Sort them definitively
  return type === "DDC" ? sortDDC(finalArray) : sortLCC(finalArray);
}
