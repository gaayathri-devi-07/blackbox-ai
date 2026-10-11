import { describe, expect, it } from "vitest";
import { createVault, luhnValid, maskDeep, maskPii, unmaskPii, verhoeffValid } from "./pii";

/** Append a Verhoeff check digit so the test Aadhaar number is valid. */
function withVerhoeff(base: string): string {
  for (let d = 0; d <= 9; d++) if (verhoeffValid(base + d)) return base + d;
  throw new Error("unreachable");
}

describe("validators", () => {
  it("accepts a Luhn-valid test card and rejects a typo", () => {
    expect(luhnValid("4111111111111111")).toBe(true);
    expect(luhnValid("4111111111111112")).toBe(false);
  });
});

describe("maskPii", () => {
  it("masks emails and phone numbers and restores them", () => {
    const input = "Reach me at priya.s@example.com or +91 98765 43210.";
    const { text, vault, found } = maskPii(input);
    expect(text).toBe("Reach me at [EMAIL_1] or [PHONE_1].");
    expect(found).toEqual({ EMAIL: 1, PHONE: 1 });
    expect(unmaskPii(text, vault)).toBe(input);
  });

  it("masks Indian identifiers: Aadhaar (checksum) and PAN", () => {
    const aadhaar = withVerhoeff("23456789012");
    const input = `Aadhaar ${aadhaar.slice(0, 4)} ${aadhaar.slice(4, 8)} ${aadhaar.slice(8)} and PAN ABCPE1234F`;
    const { text } = maskPii(input);
    expect(text).toBe("Aadhaar [AADHAAR_1] and PAN [PAN_1]");
  });

  it("masks payment cards and API keys", () => {
    const { text } = maskPii("card 4111 1111 1111 1111, key sk-proj-abcdefghijklmnopqrstuvwxyz123456");
    expect(text).toBe("card [CARD_1], key [SECRET_1]");
  });

  it("leaves technical numbers alone", () => {
    const answer =
      "From 2019-2023 I cut p99 latency from 1200 ms to 180 ms, served 15000000 requests a day, and used O(n log n) sorting on 10.5 GB.";
    expect(maskPii(answer).text).toBe(answer);
  });

  it("does not treat a 12-digit non-Aadhaar number as Aadhaar", () => {
    const aadhaar = withVerhoeff("23456789012");
    const wrong = aadhaar.slice(0, 11) + ((Number(aadhaar[11]) + 1) % 10);
    expect(maskPii(`id ${wrong}`).text).toBe(`id ${wrong}`);
  });

  it("pseudonymises known names and self-introductions consistently", () => {
    const { text, vault } = maskPii("Hi, my name is Rahul Verma. Rahul led the team; Priya Sharma reviewed it.", {
      names: ["Priya Sharma"],
    });
    expect(text).toBe("Hi, my name is [NAME_2]. Rahul led the team; [NAME_1] reviewed it.");
    expect(unmaskPii(text, vault)).toContain("Rahul Verma");
  });

  it("ignores common phrases after I'm", () => {
    expect(maskPii("I'm Excited to join and I am Responsible for search.").text).toBe(
      "I'm Excited to join and I am Responsible for search."
    );
  });

  it("shares placeholders across strings through one vault", () => {
    const vault = createVault();
    const a = maskPii("mail a@b.co", { vault }).text;
    const b = maskPii("again A@B.CO", { vault }).text;
    expect(a).toBe("mail [EMAIL_1]");
    expect(b).toBe("again [EMAIL_1]");
  });

  it("can skip kinds (speech keeps names)", () => {
    expect(maskPii("Thanks, Priya", { names: ["Priya"], skip: ["NAME"] }).text).toBe("Thanks, Priya");
  });

  it("masks nested payloads", () => {
    const out = maskDeep({ turns: [{ text: "call 98765 43210" }], n: 3 });
    expect(out).toEqual({ turns: [{ text: "call [PHONE_1]" }], n: 3 });
  });
});
