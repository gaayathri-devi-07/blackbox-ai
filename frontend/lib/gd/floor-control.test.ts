import { describe, expect, it, vi } from "vitest";
import { FloorController, MODERATOR_ID } from "./floor-control";

const PEOPLE = ["user", "ai1", "ai2", "ai3"];

function openFloor(fc: FloorController) {
  const token = fc.moderatorTakeFloor();
  expect(token).not.toBeNull();
  expect(fc.moderatorOpenFloor(token!)).toBe(true);
}

describe("FloorController", () => {
  it("rejects requests before the moderator opens the floor", () => {
    const fc = new FloorController(PEOPLE);
    expect(fc.getSnapshot().state).toBe("IDLE");
    expect(fc.requestFloor("user")).toEqual({ ok: false, reason: "not-open" });
  });

  it("puts everyone in WAITING while the moderator speaks", () => {
    const fc = new FloorController(PEOPLE);
    fc.moderatorTakeFloor();
    expect(fc.getSnapshot()).toMatchObject({ state: "MODERATOR", holder: MODERATOR_ID });
    expect(fc.requestFloor("ai1")).toEqual({ ok: false, reason: "locked" });
    for (const id of PEOPLE) expect(fc.statusOf(id)).toBe("waiting");
  });

  it("queues requests in arrival order while OPEN and ignores duplicates", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    expect(fc.requestFloor("ai2")).toEqual({ ok: true, position: 1 });
    expect(fc.requestFloor("user")).toEqual({ ok: true, position: 2 });
    expect(fc.requestFloor("ai2")).toEqual({ ok: true, position: 1 });
    expect(fc.getSnapshot().queue).toEqual(["ai2", "user"]);
    expect(fc.statusOf("user")).toBe("queued");
    expect(fc.statusOf("ai3")).toBe("idle");
  });

  it("grants an exclusive lock and blocks interruptions while LOCKED", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    fc.requestFloor("ai1");
    fc.requestFloor("user");

    const grant = fc.grantNext();
    expect(grant).toMatchObject({ id: "ai1" });
    expect(fc.getSnapshot()).toMatchObject({ state: "LOCKED", holder: "ai1", queue: ["user"] });

    // Nobody else can raise a response or take the floor mid-turn.
    expect(fc.requestFloor("ai3")).toEqual({ ok: false, reason: "locked" });
    expect(fc.requestFloor("ai1")).toEqual({ ok: false, reason: "holder" });
    expect(fc.moderatorTakeFloor()).toBeNull();
    expect(fc.grantNext()).toBeNull();
    expect(fc.statusOf("ai1")).toBe("speaking");
    expect(fc.statusOf("user")).toBe("queued");
    expect(fc.statusOf("ai3")).toBe("waiting");
  });

  it("hands the floor to queued participants sequentially after release", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    fc.requestFloor("ai1");
    fc.requestFloor("user");
    fc.requestFloor("ai2");

    const order: string[] = [];
    for (let grant = fc.grantNext(); grant; grant = fc.grantNext()) {
      order.push(grant.id);
      expect(fc.release(grant.id, grant.token)).toBe(true);
      expect(fc.getSnapshot().state).toBe("OPEN");
    }
    expect(order).toEqual(["ai1", "user", "ai2"]);
    expect(fc.getSnapshot().turns).toBe(3);
  });

  it("ignores releases from non-holders and stale tokens", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    fc.requestFloor("ai1");
    const grant = fc.grantNext()!;

    expect(fc.release("ai2", grant.token)).toBe(false);
    expect(fc.release("ai1", grant.token - 1)).toBe(false);
    expect(fc.getSnapshot().holder).toBe("ai1");

    // Watchdog ends the turn; the late async release must be a no-op.
    expect(fc.forceRelease()).toBe("ai1");
    expect(fc.release("ai1", grant.token)).toBe(false);
    expect(fc.holds("ai1", grant.token)).toBe(false);
    expect(fc.getSnapshot().turns).toBe(1);
  });

  it("does not let a stale grant speak after a new lock was issued", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    fc.requestFloor("ai1");
    const first = fc.grantNext()!;
    fc.forceRelease();
    fc.requestFloor("ai1");
    const second = fc.grantNext()!;
    expect(second.token).toBeGreaterThan(first.token);
    expect(fc.holds("ai1", first.token)).toBe(false);
    expect(fc.holds("ai1", second.token)).toBe(true);
  });

  it("lets a queued participant withdraw", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    fc.requestFloor("user");
    fc.requestFloor("ai1");
    expect(fc.withdraw("user")).toBe(true);
    expect(fc.withdraw("user")).toBe(false);
    expect(fc.grantNext()?.id).toBe("ai1");
  });

  it("lets the moderator invite a specific participant without dropping the queue", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    fc.requestFloor("ai1");
    fc.requestFloor("user");
    const invited = fc.invite("user");
    expect(invited?.id).toBe("user");
    expect(fc.getSnapshot()).toMatchObject({ state: "LOCKED", holder: "user", queue: ["ai1"] });
  });

  it("allows the moderator back in only between turns", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    fc.requestFloor("ai1");
    const grant = fc.grantNext()!;
    expect(fc.moderatorTakeFloor()).toBeNull();
    fc.release("ai1", grant.token);
    const modToken = fc.moderatorTakeFloor();
    expect(modToken).not.toBeNull();
    expect(fc.release(MODERATOR_ID, modToken!)).toBe(false);
    expect(fc.moderatorOpenFloor(modToken!)).toBe(true);
  });

  it("refuses everything once closed", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    fc.requestFloor("ai1");
    const grant = fc.grantNext()!;
    fc.close();
    expect(fc.getSnapshot()).toMatchObject({ state: "CLOSED", holder: null, queue: [] });
    expect(fc.release("ai1", grant.token)).toBe(false);
    expect(fc.requestFloor("user")).toEqual({ ok: false, reason: "closed" });
    expect(fc.moderatorTakeFloor()).toBeNull();
  });

  it("notifies subscribers with immutable snapshots", () => {
    const fc = new FloorController(PEOPLE);
    const listener = vi.fn();
    const unsubscribe = fc.subscribe(listener);
    const before = fc.getSnapshot();
    openFloor(fc);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(fc.getSnapshot()).not.toBe(before);
    expect(Object.isFrozen(fc.getSnapshot())).toBe(true);
    unsubscribe();
    fc.requestFloor("user");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("rejects unknown participants", () => {
    const fc = new FloorController(PEOPLE);
    openFloor(fc);
    expect(fc.requestFloor("intruder")).toEqual({ ok: false, reason: "unknown-participant" });
    expect(fc.invite("intruder")).toBeNull();
  });
});
