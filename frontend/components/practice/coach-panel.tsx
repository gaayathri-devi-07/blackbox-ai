"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner, Textarea } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import type { PracticeQuestionDTO } from "./types";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
}

const STARTERS = [
  "How should I structure a system design answer?",
  "Review my answer and tighten it",
  "What follow-up questions should I expect?",
];

/** Slide-over coach chat. History is persisted per question (or general). */
export function CoachPanel({
  open,
  onClose,
  question,
}: {
  open: boolean;
  onClose: () => void;
  question: PracticeQuestionDTO | null;
}) {
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const questionId = question?.id;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    api<{ messages: Message[] }>("/api/chat", { query: { questionId }, signal: controller.signal })
      .then((res) => setMessages(res.messages))
      .catch((err) => !controller.signal.aborted && toast.error("Couldn't load the conversation", errorMessage(err)))
      .finally(() => !controller.signal.aborted && setLoading(false));
    return () => controller.abort();
  }, [open, questionId, toast]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    const optimistic: Message = { id: `tmp-${Date.now()}`, role: "USER", content: message };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await api<{ messages: Message[] }>("/api/chat", {
        method: "POST",
        body: { message, ...(questionId ? { questionId } : {}) },
        timeoutMs: 40_000,
      });
      setMessages((m) => [...m.filter((x) => x.id !== optimistic.id), ...res.messages]);
    } catch (error) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setInput(message);
      toast.error("The coach couldn't respond", errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function clear() {
    try {
      await api("/api/chat", { method: "DELETE", query: { questionId } });
      setMessages([]);
    } catch (error) {
      toast.error("Couldn't clear the conversation", errorMessage(error));
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Interview coach">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l bg-background shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">Interview coach</p>
            <p className="mt-1 line-clamp-2 text-sm font-medium">{question ? question.question : "General preparation"}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            {messages.length > 0 && (
              <Button variant="ghost" size="icon-sm" onClick={clear} aria-label="Clear conversation" title="Clear conversation">
                <Trash2 />
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close coach">
              <X />
            </Button>
          </div>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 scrollbar-thin" aria-live="polite">
          {loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[13px] leading-5 text-muted-foreground">
                Ask about a concept, paste your answer for a critique, or rehearse follow-ups. Conversations are saved to your account.
              </p>
              <div className="flex flex-col gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-md border px-3 py-2 text-left text-[13px] text-muted-foreground hover:border-border-strong hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn("flex", m.role === "USER" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[88%] whitespace-pre-wrap rounded-lg px-3.5 py-2.5 text-[13px] leading-6",
                    m.role === "USER" ? "bg-primary text-primary-foreground" : "border bg-card"
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
              <Spinner /> Coach is thinking
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="border-t p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={3}
              maxLength={4000}
              placeholder="Ask a question or paste your answer"
              aria-label="Message the coach"
              className="min-h-20 resize-none pr-12"
            />
            <Button
              type="submit"
              size="icon-sm"
              className="absolute bottom-2.5 right-2.5"
              disabled={!input.trim() || sending}
              aria-label="Send message"
            >
              <ArrowUp />
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-subtle">Enter to send · Shift+Enter for a new line</p>
        </form>
      </div>
    </div>
  );
}
