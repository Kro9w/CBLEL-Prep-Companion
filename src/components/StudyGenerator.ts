import { Question } from "../MockExam";
import { loadJSON, updateRecentlySeenQuestions } from "../utils/storage";
import { generateVariations } from "./CallNumberGenerator";

const SUBJECT_SHORTS = ["LOM", "RBU", "CC", "IA", "CM", "IT"];

export type StudyQuestion = Question & {
  type: "standard" | "classification" | "shelving";
  classificationType?: "DDC" | "LCC" | "MARC";
  shelvingType?: "DDC" | "LCC";
  shelvingOriginal?: string[];
  shelvingShuffled?: string[];
  subject?: string;
  answeredLetter?: string;
  answeredCorrectly?: boolean;
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
  const rand = Math.random();
  const isShelving = rand < 0.3;
  const isClassification = rand >= 0.3 && rand < 0.75;
  const isStandard = rand >= 0.75;

  if (isShelving) {
    const type = Math.random() > 0.5 ? "DDC" : "LCC";
    try {
      const text = await fetchFile(`${type}_Shelving.txt`);
      const lines = text.split("\n").filter(Boolean);
      if (lines.length > 0) {
        const seedIndex = Math.floor(Math.random() * lines.length);
        const seed = lines[seedIndex];
        const original = generateVariations(seed, 4, type);
        const shuffled = [...original].sort(() => 0.5 - Math.random());
        return {
          number: 1,
          stem: `Arrange the following ${type} call numbers in the correct shelving order.`,
          options: [],
          type: "shelving",
          shelvingType: type,
          shelvingOriginal: original,
          shelvingShuffled: shuffled,
        };
      }
    } catch (e) {
      console.error("Shelving generation failed", e);
    }
  }

  if (isClassification) {
    const types = ["DDC", "LCC", "MARC"];
    const classType = types[Math.floor(Math.random() * types.length)];
    const isEasy = Math.random() < 0.5;

    try {
      const text = await fetchFile(`${classType}.txt`);
      const lines = text.split("\n").map((l) => l.trim());

      if (classType === "MARC") {
        const marcTags: { code: string; description: string }[] = [];
        const marcSubfields: {
          tagCode: string;
          tagDesc: string;
          code: string;
          description: string;
        }[] = [];

        let currentMarcTag: { code: string; description: string } | null = null;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const tagMatch = line.match(/^(\d{3})\s*=\s*(.+)$/);
          if (tagMatch) {
            currentMarcTag = {
              code: tagMatch[1].trim(),
              description: tagMatch[2].trim(),
            };
            marcTags.push(currentMarcTag);
          } else if (line.startsWith("$") && currentMarcTag) {
            const subMatch = line.match(/^(\$[a-z0-9])\s*=\s*(.+)$/);
            if (subMatch) {
              marcSubfields.push({
                tagCode: currentMarcTag.code,
                tagDesc: currentMarcTag.description,
                code: subMatch[1].trim(),
                description: subMatch[2].trim(),
              });
            }
          }
        }

        if (marcTags.length < 4) throw new Error("Not enough MARC tags");

        let qType = Math.random() > 0.5 ? "Tags" : "Subfields";
        if (qType === "Subfields" && marcSubfields.length === 0) {
          qType = "Tags";
        }

        let stem = "";
        let correctText = "";
        let explanation = "";
        const wrongOptions: string[] = [];

        if (qType === "Tags") {
          const isAskCode = Math.random() > 0.5;
          const target = marcTags[Math.floor(Math.random() * marcTags.length)];

          if (isAskCode) {
            stem = `Which MARC tag is used for "${target.description}"?`;
            correctText = target.code;
            explanation = `MARC tag ${target.code} represents ${target.description}.`;
            const others = marcTags
              .filter((t) => t.code !== target.code)
              .sort(() => 0.5 - Math.random());
            wrongOptions.push(...others.slice(0, 3).map((w) => w.code));
          } else {
            stem = `What does MARC tag "${target.code}" represent?`;
            correctText = target.description;
            explanation = `MARC tag ${target.code} represents ${target.description}.`;
            const others = marcTags
              .filter((t) => t.code !== target.code)
              .sort(() => 0.5 - Math.random());
            wrongOptions.push(...others.slice(0, 3).map((w) => w.description));
          }
        } else {
          // Subfields
          const target =
            marcSubfields[Math.floor(Math.random() * marcSubfields.length)];
          const isAskCode = Math.random() > 0.5;

          if (isAskCode) {
            stem = `Under MARC tag ${target.tagCode} (${target.tagDesc}), which subfield code is used for "${target.description}"?`;
            correctText = target.code;
            explanation = `Under MARC tag ${target.tagCode}, the subfield code for "${target.description}" is ${target.code}.`;

            let others = marcSubfields.filter(
              (s) => s.tagCode === target.tagCode && s.code !== target.code,
            );
            if (others.length < 3) {
              const extras = marcSubfields.filter(
                (s) => s.tagCode !== target.tagCode && s.code !== target.code,
              );
              others = others.concat(extras.sort(() => 0.5 - Math.random()));
            }
            const wrongItems = others.sort(() => 0.5 - Math.random());
            const uniqueWrongs = Array.from(
              new Set(wrongItems.map((w) => w.code)),
            );
            while (uniqueWrongs.length < 3) {
              const extras = marcSubfields
                .filter(
                  (s) =>
                    s.code !== target.code && !uniqueWrongs.includes(s.code),
                )
                .sort(() => 0.5 - Math.random());
              if (extras.length > 0) uniqueWrongs.push(extras[0].code);
              else break;
            }
            wrongOptions.push(...uniqueWrongs.slice(0, 3));
          } else {
            stem = `Under MARC tag ${target.tagCode} (${target.tagDesc}), what does subfield code "${target.code}" represent?`;
            correctText = target.description;
            explanation = `Under MARC tag ${target.tagCode}, subfield code ${target.code} represents "${target.description}".`;

            let others = marcSubfields.filter(
              (s) =>
                s.tagCode === target.tagCode &&
                s.description !== target.description,
            );
            if (others.length < 3) {
              const extras = marcSubfields.filter(
                (s) =>
                  s.tagCode !== target.tagCode &&
                  s.description !== target.description,
              );
              others = others.concat(extras.sort(() => 0.5 - Math.random()));
            }
            const wrongItems = others.sort(() => 0.5 - Math.random());
            const uniqueWrongs = Array.from(
              new Set(wrongItems.map((w) => w.description)),
            );
            while (uniqueWrongs.length < 3) {
              const extras = marcSubfields
                .filter(
                  (s) =>
                    s.description !== target.description &&
                    !uniqueWrongs.includes(s.description),
                )
                .sort(() => 0.5 - Math.random());
              if (extras.length > 0) uniqueWrongs.push(extras[0].description);
              else break;
            }
            wrongOptions.push(...uniqueWrongs.slice(0, 3));
          }
        }

        while (wrongOptions.length < 3) {
          wrongOptions.push(`Distractor ${wrongOptions.length + 1}`);
        }

        const options = [{ letter: "A", text: correctText, correct: true }];
        wrongOptions.slice(0, 3).forEach((wText, idx) => {
          options.push({
            letter: String.fromCharCode(66 + idx),
            text: wText,
            correct: false,
          });
        });

        const finalOptions = options
          .sort(() => 0.5 - Math.random())
          .map((opt, i) => ({
            ...opt,
            letter: String.fromCharCode(65 + i),
          }));

        return {
          number: 1,
          stem,
          options: finalOptions,
          explanation,
          type: "classification",
          classificationType: classType as any,
        };
      }

      const items: { code: string; description: string }[] = [];

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
        classificationType: classType as "DDC" | "LCC" | "MARC",
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
