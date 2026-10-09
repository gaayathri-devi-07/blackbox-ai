/**
 * SpeakerController — manages the speaker queue and current speaker.
 * Callbacks notify React state so the UI stays in sync.
 */
export class SpeakerController {
  private queue: string[] = [];
  private current: string | null = null;
  private onSpeakerChange: (speaker: string | null) => void;
  private onQueueChange: (queue: string[]) => void;

  constructor(
    onSpeakerChange: (speaker: string | null) => void,
    onQueueChange: (queue: string[]) => void
  ) {
    this.onSpeakerChange = onSpeakerChange;
    this.onQueueChange = onQueueChange;
  }

  /** Add participant to the back of the queue (no-op if already queued or speaking). */
  raiseHand(id: string): void {
    if (this.queue.includes(id) || this.current === id) return;
    this.queue = [...this.queue, id];
    this.onQueueChange([...this.queue]);
  }

  /** Remove participant from queue. */
  lowerHand(id: string): void {
    this.queue = this.queue.filter((x) => x !== id);
    this.onQueueChange([...this.queue]);
  }

  /** Pop front of queue, set as current speaker. Returns id or null. */
  selectNext(): string | null {
    if (this.queue.length === 0) return null;
    const [next, ...rest] = this.queue;
    this.queue = rest;
    this.current = next;
    this.onSpeakerChange(next);
    this.onQueueChange([...this.queue]);
    return next;
  }

  /** Called when the current speaker finishes talking. */
  finishSpeaking(): void {
    this.current = null;
    this.onSpeakerChange(null);
  }

  get currentSpeaker(): string | null {
    return this.current;
  }

  get handQueue(): string[] {
    return [...this.queue];
  }

  isInQueue(id: string): boolean {
    return this.queue.includes(id);
  }

  isCurrentSpeaker(id: string): boolean {
    return this.current === id;
  }

  reset(): void {
    this.queue = [];
    this.current = null;
    this.onSpeakerChange(null);
    this.onQueueChange([]);
  }
}
