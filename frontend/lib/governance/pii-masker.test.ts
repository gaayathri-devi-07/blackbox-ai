import { describe, expect, it } from "vitest";
import { redact, redactDeep, redactForStorage } from "./pii-masker";

describe("redactForStorage", () => {
  it("removes contact details and keeps the rest readable", () => {
    const { text, redacted } = redactForStorage("I'm Priya, reach me at priya@gmail.com or +91 98765 43210 about the Kafka project.");
    expect(text).toBe("I'm Priya, reach me at [EMAIL REDACTED] or [PHONE REDACTED] about the Kafka project.");
    expect(redacted).toEqual({ EMAIL: 1, PHONE: 1 });
  });

  it("redacts street addresses and PIN codes", () => {
    expect(redact("Send it to 42 Residency Road, Bengaluru 560025 please.")).toBe("Send it to [ADDRESS REDACTED] please.");
    expect(redact("My address is Flat 12B Lake View Apartments, Powai")).toBe("My address is [ADDRESS REDACTED]");
    expect(redact("Flat 4, Green Park, Chennai 600040 is where I stay")).toBe("[ADDRESS REDACTED] is where I stay");
    expect(redact("PIN code: 560001")).toBe("PIN code: [ADDRESS REDACTED]");
  });

  it("redacts Indian government IDs", () => {
    expect(redact("passport number J8369854")).toBe("passport number [PASSPORT REDACTED]");
    expect(redact("voter id ABC1234567")).toBe("voter id [VOTER ID REDACTED]");
    expect(redact("licence TN-01-2019-1234567")).toBe("licence [DRIVING LICENCE REDACTED]");
    expect(redact("PAN ABCPE1234F")).toBe("PAN [PAN REDACTED]");
  });

  it("leaves technical content alone", () => {
    const answer = "We cut p99 from 1200 ms to 180 ms in 2023 using Redis on port 6379 and model v2.1.0 with 512 MB.";
    expect(redact(answer)).toBe(answer);
    expect(redact("I used the 3rd Main approach")).toBe("I used the 3rd Main approach");
  });

  it("redacts nested transcripts", () => {
    const turns = [{ role: "candidate", content: "mail me: a.b@x.io", at: 1 }];
    expect(redactDeep(turns)).toEqual([{ role: "candidate", content: "mail me: [EMAIL REDACTED]", at: 1 }]);
  });
});
