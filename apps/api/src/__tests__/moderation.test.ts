import { describe, it, expect } from "vitest";
import {
  ModerationService,
  normalizeText,
  deobfuscateText,
} from "../services/moderation.service";

describe("Moderation: text normalizers", () => {
  it("strips diacritics and normalizes whitespace", () => {
    expect(normalizeText("Café  au   lait")).toBe("cafe au lait");
    expect(normalizeText("Mărījuāna")).toBe("marijuana");
  });

  it("deobfuscates leetspeak substitutions", () => {
    expect(deobfuscateText("w33d")).toBe("weed");
    expect(deobfuscateText("c0ca1ne")).toBe("cocaine");
    expect(deobfuscateText("p0rn")).toBe("porn");
    expect(deobfuscateText("h3r01n")).toBe("heroin");
  });
});

describe("ModerationService: keyword scan", () => {
  const service = new ModerationService();

  it("returns clean for benign student listings", () => {
    const res = service.scanContent(
      "MacBook Pro M1 16GB",
      "Gently used laptop for computer science student in good condition. Comes with charger."
    );
    expect(res.result).toBe("clean");
    expect(res.flags).toHaveLength(0);
  });

  it("flags exact prohibited terms", () => {
    const res = service.scanContent(
      "Clean Glock 19 Handgun",
      "Comes with 9mm ammunition and holster."
    );
    expect(res.result).toBe("flagged");
    expect(res.flags).toContain("handgun");
    expect(res.flags).toContain("ammunition");
  });

  it("flags obfuscated terms like w33d", () => {
    const res = service.scanContent(
      "High quality w33d available on campus",
      "DM for prices."
    );
    expect(res.result).toBe("flagged");
    expect(res.flags).toContain("weed");
  });

  it("flags multi-word prohibited phrases", () => {
    const res = service.scanContent(
      "Grade A Counterfeit Currency",
      "Undetectable fake notes for sale."
    );
    expect(res.result).toBe("flagged");
    expect(res.flags).toContain("counterfeit currency");
    expect(res.flags).toContain("fake notes");
  });

  it("respects word boundaries to avoid false positives", () => {
    const res = service.scanContent(
      "Organic Weedkiller for Hostel Garden",
      "Non-toxic formulation for weeds."
    );
    // "weed" in "weedkiller" should not trigger because of word boundary
    // wait, does "weeds" trigger? "weed" \bweed\b does not match "weeds".
    expect(res.result).toBe("clean");
  });

  it("flags academic dishonesty services", () => {
    const res = service.scanContent(
      "Assignment Writing Service for UNIOSUN Students",
      "We handle your final year project and exam answers."
    );
    expect(res.result).toBe("flagged");
    expect(res.flags).toContain("assignment writing service");
    expect(res.flags).toContain("exam answers");
  });
});
