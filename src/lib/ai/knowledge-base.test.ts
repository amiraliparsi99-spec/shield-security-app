import { describe, it, expect } from "vitest";
import { SECURITY_KNOWLEDGE_BASE } from "./knowledge-base";
import type { KnowledgeDocument } from "./knowledge-base";

describe("SECURITY_KNOWLEDGE_BASE", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(SECURITY_KNOWLEDGE_BASE)).toBe(true);
    expect(SECURITY_KNOWLEDGE_BASE.length).toBeGreaterThan(0);
  });

  it("every document has required fields", () => {
    const required: (keyof KnowledgeDocument)[] = [
      "title",
      "content",
      "category",
      "keywords",
      "applicable_roles",
      "priority",
    ];
    for (const doc of SECURITY_KNOWLEDGE_BASE) {
      for (const key of required) {
        expect(doc).toHaveProperty(key);
      }
      expect(typeof doc.title).toBe("string");
      expect(typeof doc.content).toBe("string");
      expect(Array.isArray(doc.keywords)).toBe(true);
      expect(Array.isArray(doc.applicable_roles)).toBe(true);
      expect(typeof doc.priority).toBe("number");
      expect(doc.priority).toBeGreaterThanOrEqual(1);
      expect(doc.priority).toBeLessThanOrEqual(10);
    }
  });

  it("applicable_roles only contain venue, agency, personnel", () => {
    const allowed = new Set(["venue", "agency", "personnel"]);
    for (const doc of SECURITY_KNOWLEDGE_BASE) {
      for (const role of doc.applicable_roles) {
        expect(allowed.has(role)).toBe(true);
      }
    }
  });

  it("contains SIA licensing content", () => {
    const hasSIA = SECURITY_KNOWLEDGE_BASE.some(
      (d) =>
        d.title.toLowerCase().includes("sia") ||
        d.keywords.some((k) => k.toLowerCase().includes("sia"))
    );
    expect(hasSIA).toBe(true);
  });
});
