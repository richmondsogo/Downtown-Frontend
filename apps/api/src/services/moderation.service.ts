import fs from "fs";
import path from "path";

export interface ModerationScanResult {
  result: "clean" | "flagged";
  flags: string[];
}

/**
 * Normalizes text for moderation scanning:
 * 1. Lowercase
 * 2. Strip diacritics / accents
 * 3. Normalize repeated whitespace
 */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Light de-obfuscation for leetspeak and symbol substitutions (e.g., w33d -> weed, p0rn -> porn)
 */
export function deobfuscateText(text: string): string {
  const normalized = normalizeText(text);
  return normalized
    .replace(/[@4]/g, "a")
    .replace(/[3]/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/[0]/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/[7+]/g, "t")
    .replace(/[8]/g, "b");
}

export class ModerationService {
  private terms: string[] = [];

  constructor(csvPath?: string) {
    this.loadTerms(csvPath);
  }

  private loadTerms(customPath?: string): void {
    const candidatePaths = [
      customPath,
      path.resolve(process.cwd(), "docs/data/prohibited-terms.csv"),
      path.resolve(__dirname, "../../../../../docs/data/prohibited-terms.csv"),
      path.resolve(__dirname, "../../../../docs/data/prohibited-terms.csv"),
      path.resolve(__dirname, "../../../docs/data/prohibited-terms.csv"),
    ].filter(Boolean) as string[];

    let loaded = false;
    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, "utf-8");
          const lines = content.split(/\r?\n/);
          const terms: string[] = [];
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i]?.trim();
            if (!line) continue;
            const parts = line.split(",");
            const term = parts[0]?.trim().toLowerCase();
            if (term) terms.push(term);
          }
          if (terms.length > 0) {
            this.terms = Array.from(new Set(terms));
            loaded = true;
            break;
          }
        } catch {
          // Continue to fallback
        }
      }
    }

    if (!loaded) {
      // Conservative hardcoded fallback seed list
      this.terms = [
        "handgun",
        "pistol",
        "rifle",
        "shotgun",
        "firearm",
        "ammunition",
        "ammo",
        "grenade",
        "explosive",
        "switchblade",
        "machete",
        "cocaine",
        "heroin",
        "methamphetamine",
        "crystal meth",
        "marijuana",
        "weed",
        "cannabis",
        "tramadol",
        "codeine",
        "ecstasy",
        "mdma",
        "counterfeit currency",
        "counterfeit money",
        "fake currency",
        "fake notes",
        "forged documents",
        "fake passport",
        "stolen goods",
        "stolen phone",
        "stolen laptop",
        "live animal",
        "live dog",
        "live cat",
        "live monkey",
        "pornography",
        "escort service",
        "prostitution",
        "adult content",
        "exam leakage",
        "exam answers",
        "assignment writing service",
        "essay writing service",
        "fake certificate",
        "forged certificate",
      ];
    }
  }

  /**
   * Scans content (title + description) for prohibited keywords using word-boundary matching
   * and light obfuscation detection.
   */
  public scanContent(title: string, description: string = ""): ModerationScanResult {
    const combined = `${title} ${description}`;
    const normalized = normalizeText(combined);
    const deobfuscated = deobfuscateText(combined);

    const flags: Set<string> = new Set();

    for (const term of this.terms) {
      const termNormalized = normalizeText(term);
      if (!termNormalized) continue;

      // Word boundary regex: escape special characters
      const escaped = termNormalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const wordBoundaryRegex = new RegExp(`\\b${escaped}\\b`, "i");

      if (wordBoundaryRegex.test(normalized) || wordBoundaryRegex.test(deobfuscated)) {
        flags.add(term);
      }
    }

    const flagArray = Array.from(flags);
    return {
      result: flagArray.length > 0 ? "flagged" : "clean",
      flags: flagArray,
    };
  }
}

export const defaultModerationService = new ModerationService();
