import { describe, expect, it } from "vitest";
import { readAnswer } from "./answer-signals";

describe("readAnswer", () => {
  it("recognises a candidate who doesn't know", () => {
    for (const text of [
      "I don't know this one.",
      "Honestly I have no idea what that is",
      "I'm not familiar with training-serving skew",
      "Sorry, I haven't studied this concept",
    ]) {
      expect(readAnswer(text).dontKnow, text).toBe(true);
    }
  });

  it("recognises a request for help even when dictation dropped words", () => {
    // Real transcript from a session: "know" was lost by the recognizer.
    const s = readAnswer("I don't Can you give some insights based on this concept");
    expect(s.asksForHelp).toBe(true);
  });

  it("treats a substantive answer that hedges once as an attempt", () => {
    const long =
      "I'm not sure about the exact numbers, but I would start by separating the training pipeline from the serving pipeline, " +
      "then log the features at serving time and compare their distributions with the training data every day, alerting when " +
      "they drift. I would also share one feature transformation library between both paths so the logic cannot diverge, and " +
      "add a shadow deployment before rollout.";
    expect(readAnswer(long).dontKnow).toBe(false);
  });

  it("detects a project story and the technologies in it", () => {
    const s = readAnswer(
      "In my final year project I built a RAG chatbot over our college notes using a vector database and deployed it with Docker on AWS."
    );
    expect(s.mentionsProject).toBe(true);
    const keys = s.technologies.map((t) => t.key);
    expect(keys[0]).toBe("rag");
    expect(keys).toEqual(expect.arrayContaining(["vector-db", "docker", "cloud"]));
  });

  it("does not flag an ordinary answer", () => {
    const s = readAnswer("Precision matters when false positives are expensive, recall when missing a case is worse.");
    expect(s.dontKnow).toBe(false);
    expect(s.asksForHelp).toBe(false);
    expect(s.mentionsProject).toBe(false);
  });
});

describe("offers to elaborate", () => {
  it("recognises an offer to explain a project, even in chat spelling", () => {
    const s = readAnswer("i was intrested in ai and ml and wanted to prepare on it thatswhere my journey started ,do u want to hear abt my project ?");
    expect(s.offersToElaborate).toBe(true);
    expect(s.dontKnow).toBe(false);
    expect(s.asksForHelp).toBe(false);
  });

  it("recognises other phrasings and extracts the project topic", () => {
    expect(readAnswer("Shall I explain how it works?").offersToElaborate).toBe(true);
    expect(readAnswer("If you're interested I can go into the details.").offersToElaborate).toBe(true);
    const s = readAnswer("I built a project on fake news detection using BERT, and I'd love to explain it.");
    expect(s.offersToElaborate).toBe(true);
    expect(s.projectTopic).toBe("fake news detection");
  });

  it("does not treat a normal answer as an offer", () => {
    expect(readAnswer("We used Redis as a cache in front of Postgres to cut read latency.").offersToElaborate).toBe(false);
  });
});
