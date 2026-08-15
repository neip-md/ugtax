import { describe, test, expect } from "vitest";
import { parseLlmResponse } from "../llm";

describe("parseLlmResponse", () => {
  test("parses valid JSON array", () => {
    const input = JSON.stringify([
      { index: 0, account: "6300", description: "Aufwand", confidence: "high" },
    ]);
    const result = parseLlmResponse(input, 2);
    expect(result).toHaveLength(1);
    expect(result[0].account).toBe("6300");
    expect(result[0].account_name).toBeTruthy();
    expect(result[0].confidence).toBe("high");
  });

  test("extracts JSON from markdown code block", () => {
    const input = '```json\n[{"index": 0, "account": "6855", "description": "Gebühr", "confidence": "medium"}]\n```';
    const result = parseLlmResponse(input, 1);
    expect(result).toHaveLength(1);
    expect(result[0].account).toBe("6855");
  });

  test("skips invalid account numbers", () => {
    const input = JSON.stringify([
      { index: 0, account: "9999", description: "Bad", confidence: "high" },
    ]);
    const result = parseLlmResponse(input, 1);
    expect(result).toHaveLength(0);
  });

  test("skips out-of-range indices", () => {
    const input = JSON.stringify([
      { index: 5, account: "6300", description: "X", confidence: "high" },
    ]);
    const result = parseLlmResponse(input, 2);
    expect(result).toHaveLength(0);
  });

  test("returns empty for garbage input", () => {
    expect(parseLlmResponse("not json at all", 1)).toEqual([]);
    expect(parseLlmResponse("", 1)).toEqual([]);
  });

  test("defaults unknown confidence to low", () => {
    const input = JSON.stringify([
      { index: 0, account: "6300", description: "X", confidence: "very_high" },
    ]);
    const result = parseLlmResponse(input, 1);
    expect(result[0].confidence).toBe("low");
  });
});
