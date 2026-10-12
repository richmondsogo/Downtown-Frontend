import fs from "fs";
import path from "path";

const KNOWN_CAMPUS_SLUGS = [
  "osogbo",
  "ikire",
  "okuku",
  "ifetedo",
  "ipetu-ijesha",
  "ejigbo",
];

// Simple regexes for PII, phones, URLs
const PHONE_REGEX = /(\+?234|0)[789][01]\d{8}/;
const URL_REGEX = /https?:\/\/|www\./i;
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function validate() {
  const csvPath = path.resolve(__dirname, "../docs/data/student-areas.csv");
  const raw = fs.readFileSync(csvPath, "utf-8").trim();
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

  if (lines.length === 0) {
    console.error("Empty CSV file!");
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]);
  console.log("Headers:", header);
  const expectedHeaders = ["campus_slug", "name", "slug", "description"];
  const headerMatch = header.every((h, i) => h === expectedHeaders[i]);
  if (!headerMatch) {
    console.error("Header mismatch! Expected:", expectedHeaders, "Got:", header);
    process.exit(1);
  }

  const campusCounts: Record<string, number> = {};
  const namesByCampus: Record<string, Set<string>> = {};
  const rejectedRows: Array<{ row: number; reason: string; line: string }> = [];
  const normalizedRows: Array<{ row: number; before: string; after: string }> = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1;
    const parts = parseCsvLine(lines[i]);
    const [campusSlug, name, slug, description] = parts;

    // Check campus slug
    if (!KNOWN_CAMPUS_SLUGS.includes(campusSlug)) {
      rejectedRows.push({ row: rowNum, reason: `Unknown campus slug '${campusSlug}'`, line: lines[i] });
      continue;
    }

    // Check length
    if (!name || name.length < 2 || name.length > 100) {
      rejectedRows.push({ row: rowNum, reason: `Invalid name length (${name?.length}): '${name}'`, line: lines[i] });
      continue;
    }

    // Check PII / phone / url in name or description
    const fullText = `${name} ${slug} ${description || ""}`;
    if (PHONE_REGEX.test(fullText)) {
      rejectedRows.push({ row: rowNum, reason: `Contains phone number`, line: lines[i] });
      continue;
    }
    if (URL_REGEX.test(fullText)) {
      rejectedRows.push({ row: rowNum, reason: `Contains URL`, line: lines[i] });
      continue;
    }
    if (EMAIL_REGEX.test(fullText)) {
      rejectedRows.push({ row: rowNum, reason: `Contains email address`, line: lines[i] });
      continue;
    }

    // Check duplicate name per campus (case-insensitive)
    if (!namesByCampus[campusSlug]) {
      namesByCampus[campusSlug] = new Set();
    }
    const lowerName = name.toLowerCase();
    if (namesByCampus[campusSlug].has(lowerName)) {
      rejectedRows.push({ row: rowNum, reason: `Duplicate name '${name}' for campus '${campusSlug}'`, line: lines[i] });
      continue;
    }
    namesByCampus[campusSlug].add(lowerName);

    // Track counts
    campusCounts[campusSlug] = (campusCounts[campusSlug] || 0) + 1;
  }

  console.log("\n=== Validation Results ===");
  console.log("Total data rows processed:", lines.length - 1);
  console.log("Row counts per campus:", campusCounts);
  console.log("Rejected rows:", rejectedRows.length === 0 ? "None (0)" : rejectedRows);
  console.log("Normalized rows:", normalizedRows.length === 0 ? "None (0)" : normalizedRows);
}

validate();
