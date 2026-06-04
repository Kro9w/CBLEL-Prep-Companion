import { Question } from "../MockExam";
import { loadJSON, updateRecentlySeenQuestions } from "../utils/storage";

const SUBJECT_SHORTS = ["LOM", "RBU", "CC", "IA", "CM", "IT"];

export type StudyQuestion = Question & {
  type: "standard" | "classification";
  classificationType?: "DDC" | "LCC";
  subject?: string;
  answeredLetter?: string;
};

const cache: Record<string, string> = {};

async function fetchFile(filename: string): Promise<string> {
  if (cache[filename]) return cache[filename];
  const res = await fetch(filename);
  if (!res.ok) throw new Error(`Failed to fetch ${filename}`);
  const text = await res.text();
  cache[filename] = text;
  return text;
}

export async function generateQuestion(): Promise<StudyQuestion> {
  const isClassification = Math.random() < 0.65;

  if (isClassification) {
    const classType = Math.random() < 0.5 ? "DDC" : "LCC";
    const isEasy = Math.random() < 0.5;

    try {
      const text = await fetchFile(`${classType}.txt`);
      const items: { code: string; description: string }[] = [];
      const lines = text.split("\n").map((l) => l.trim());

      let inEasyHeader = false;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (classType === "DDC") {
          if (line.startsWith("###")) {
            inEasyHeader = true;
            if (isEasy) {
              const match = line.match(/###\s*([0-9]+)\s*—\s*(.+)/);
              if (match)
                items.push({
                  code: match[1].trim(),
                  description: match[2].trim(),
                });
            }
          } else if (line.startsWith("##") && !line.startsWith("###")) {
            inEasyHeader = false;
          }
        } else {
          if (line.startsWith("##") && !line.startsWith("###")) {
            inEasyHeader = true;
            if (isEasy) {
              const match = line.match(/##\s*([A-Z]+)\s*—\s*(.+)/);
              if (match)
                items.push({
                  code: match[1].trim(),
                  description: match[2].trim(),
                });
            }
          } else if (line.startsWith("#")) {
            inEasyHeader = false;
          }
        }

        if (!isEasy || (isEasy && !inEasyHeader)) {
          if (line.startsWith("|")) {
            const cols = line
              .split("|")
              .map((c) => c.trim())
              .filter(Boolean);

            // Strictly check formatting: cols[0] shouldn't have ---
            // It also must not be a table header like "No.", "Subclass", "Number", "Class"
            if (
              cols.length >= 2 &&
              !cols[0].includes("---") &&
              !cols[0].toLowerCase().includes("no.") &&
              cols[0].toLowerCase() !== "subclass" &&
              cols[0].toLowerCase() !== "number" &&
              cols[0].toLowerCase() !== "class" &&
              cols[1].toLowerCase() !== "description"
            ) {
              items.push({ code: cols[0], description: cols[1] });
            }
          }
        }
      }

      if (items.length < 4) throw new Error("Not enough items");

      const shuffled = items.sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 4);
      const target = selected[0];

      const askForCode = Math.random() < 0.5;
      let stem = "";
      let options = [];

      if (askForCode) {
        stem = `What is the ${classType} code for "${target.description}"?`;
        options = selected.map((s) => s.code);
      } else {
        stem = `What does the ${classType} code "${target.code}" represent?`;
        options = selected.map((s) => s.description);
      }

      const finalOptions = options
        .sort(() => 0.5 - Math.random())
        .map((opt, i) => ({
          letter: String.fromCharCode(65 + i),
          text: opt,
          correct: opt === (askForCode ? target.code : target.description),
        }));

      return {
        number: 1,
        stem,
        options: finalOptions,
        explanation: `The ${classType} classification for "${target.description}" is ${target.code}.`,
        type: "classification",
        classificationType: classType,
      };
    } catch (e) {
      console.error(e);
      return generateStandardQuestion();
    }
  } else {
    return generateStandardQuestion();
  }
}

async function generateStandardQuestion(): Promise<StudyQuestion> {
  const subject =
    SUBJECT_SHORTS[Math.floor(Math.random() * SUBJECT_SHORTS.length)];
  try {
    const text = await fetchFile(`QBank_${subject}.txt`);

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const questions: any[] = [];
    let current: any = null;

    const questionReOld = /^(\d+)[.)]\s+(.+)$/;
    const questionReNew = /^Q\.\s+(.+)$/i;
    const optionReOld = /^(\*?)([A-Da-d])[.)]\s+(.+)$/;
    const optionReNew = /^(\*?)O\.\s+(.+)$/i;
    const explanationRe = /^Y:\s+(.+)$/i;
    const examCodeRe = /^[A-Z]{2,6}_\d+$/i;

    let qc = 1;
    for (const line of lines) {
      if (examCodeRe.test(line)) continue;

      const qMatchOld = line.match(questionReOld);
      const qMatchNew = line.match(questionReNew);
      const oMatchOld = line.match(optionReOld);
      const oMatchNew = line.match(optionReNew);
      const yMatch = line.match(explanationRe);

      if (qMatchOld || qMatchNew) {
        if (current && current.stem && current.options.length > 0)
          questions.push(current);
        const stemText = qMatchOld
          ? qMatchOld[2]
          : qMatchNew
            ? qMatchNew[1]
            : "";
        current = { number: qc++, stem: stemText, options: [] };
      } else if ((oMatchOld || oMatchNew) && current) {
        const isCorrect = !!(oMatchOld ? oMatchOld[1] : oMatchNew![1]);
        const letter = oMatchOld
          ? oMatchOld[2].toUpperCase()
          : String.fromCharCode(65 + current.options.length);
        const text = oMatchOld ? oMatchOld[3] : oMatchNew![2];
        current.options.push({ letter, text, correct: isCorrect });
      } else if (yMatch && current) {
        current.explanation = yMatch[1];
      }
    }
    if (current && current.stem && current.options.length > 0)
      questions.push(current);

    if (questions.length === 0) throw new Error("No questions found");

    const recent = loadJSON<string[]>("recentlySeenQuestions", []);
    let q = questions[Math.floor(Math.random() * questions.length)];

    // Try up to 10 times to find a question we haven't seen recently
    for (let attempts = 0; attempts < 10; attempts++) {
      if (!recent.includes(q.stem)) break;
      q = questions[Math.floor(Math.random() * questions.length)];
    }

    updateRecentlySeenQuestions([q.stem]);

    q.options = q.options
      .sort(() => 0.5 - Math.random())
      .map((opt: any, i: number) => ({
        ...opt,
        letter: String.fromCharCode(65 + i),
      }));

    return {
      ...q,
      type: "standard",
      subject,
    };
  } catch (e) {
    console.error(e);
    return {
      number: 1,
      stem: "Error loading question. Please try again later.",
      options: [
        { letter: "A", text: "Option 1", correct: true },
        { letter: "B", text: "Option 2", correct: false },
      ],
      type: "standard",
      subject: "Error",
    };
  }
}
