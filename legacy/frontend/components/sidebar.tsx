"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import CompanionSelector from "./CompanionSelector";
import { ThemeToggle } from "./ThemeToggle";

interface UserProfile {
  name: string;
  email: string;
  bio: string;
  avatar: string;
}

const AVATAR_OPTIONS = ["👤", "🧑‍💻", "👩‍💻", "🧑‍🚀", "👩‍🚀", "🦸", "🧙", "🧝", "🦊", "🐬"];

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "account">("menu");
  const [editing, setEditing] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ name: "Explorer", email: "", bio: "", avatar: "👤" });
  const [draft, setDraft] = useState<UserProfile>(profile);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("userProfile");
    if (saved) {
      const p = JSON.parse(saved) as UserProfile;
      setProfile(p);
      setDraft(p);
    } else {
      const comp = localStorage.getItem("companion");
      if (comp) {
        const c = JSON.parse(comp) as { id: string; name: string };
        const EMOJIS: Record<string, string> = { luna: "🌙", nova: "⭐", stella: "✨", orion: "🌟", cosmo: "🪐" };
        const defaults = { name: c.name, email: "", bio: "", avatar: EMOJIS[c.id] ?? "👤" };
        setProfile(defaults);
        setDraft(defaults);
      }
    }
  }, []);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    if (open) document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  function closePanel() {
    setOpen(false);
    setView("menu");
    setEditing(false);
    setDraft(profile);
  }

  function saveProfile() {
    setProfile(draft);
    localStorage.setItem("userProfile", JSON.stringify(draft));
    setEditing(false);
  }

  function handleLogout() {
    signOut(auth).catch(() => {});
    localStorage.removeItem("companion");
    localStorage.removeItem("career");
    localStorage.removeItem("userProfile");
    router.push("/");
  }

  // Hide on onboarding pages
  const SKIP = ["/", "/career", "/companion"];
  if (SKIP.includes(pathname ?? "")) return null;


  return (
    <>
      {/* Hamburger button — fixed top-left */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-4 left-4 z-50 flex flex-col justify-center items-center gap-[5px] w-9 h-9 rounded-lg"
        style={{ background: "rgba(148,163,184,0.2)", border: "1px solid rgba(148,163,184,0.35)" }}
        aria-label="Open menu"
      >
        <span className="block w-4 h-[1.5px] bg-slate-700 dark:bg-white/70 rounded-full" />
        <span className="block w-4 h-[1.5px] bg-slate-700 dark:bg-white/70 rounded-full" />
        <span className="block w-4 h-[1.5px] bg-slate-700 dark:bg-white/70 rounded-full" />
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={closePanel}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="sidebar"
            ref={panelRef}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col bg-white dark:bg-[#0a0a0a] border-r border-gray-200 dark:border-white/10 transition-colors duration-300"
          >
            {/* Header */}
            <div className="flex flex-col gap-3 px-5 py-5 border-b border-gray-200 dark:border-white/10">
              <div className="flex items-center justify-between">
                {view === "account" ? (
                  <button
                    onClick={() => { setView("menu"); setEditing(false); setDraft(profile); }}
                    className="text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white text-sm flex items-center gap-2 transition-colors"
                  >
                    ← Back
                  </button>
                ) : (
                  <span className="text-sm font-bold tracking-widest text-slate-700 dark:text-white/80 uppercase">Menu</span>
                )}
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <button onClick={closePanel} className="text-slate-500 dark:text-white/40 hover:text-slate-900 dark:hover:text-white text-lg transition-colors">✕</button>
                </div>
              </div>
              {view === "menu" && <CompanionSelector />}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {view === "menu" ? (
                /* ── Main menu ── */
                <div className="py-3">
                  <MenuItem
  icon="🏠"
  label="Home"
  onClick={() => { router.push("/journey"); closePanel(); }}
/>
                  <MenuItem
                    icon="👤"
                    label="Account"
                    onClick={() => setView("account")}
                  />
                </div>
              ) : (
                /* ── Account panel ── */
                <div className="px-5 py-5">
                  {!editing ? (
                    /* View */
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                        style={{ background: "rgba(139,92,246,0.2)", border: "2px solid rgba(139,92,246,0.4)" }}
                      >
                        {profile.avatar}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{profile.name}</p>
                        {profile.email && <p className="text-xs text-slate-500 dark:text-white/40 mt-0.5">{profile.email}</p>}
                        {profile.bio && <p className="text-xs text-slate-600 dark:text-white/50 mt-2 leading-relaxed">{profile.bio}</p>}
                      </div>
                      <button
                        onClick={() => { setDraft(profile); setEditing(true); }}
                        className="w-full py-2 rounded-xl text-xs font-semibold text-purple-300 transition-colors"
                        style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}
                      >
                        Edit Profile
                      </button>
                    </div>
                  ) : (
                    /* Edit */
                    <div className="flex flex-col gap-4">
                      {/* Avatar picker */}
                      <div>
                        <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest mb-2">Avatar</p>
                        <div className="flex flex-wrap gap-2">
                          {AVATAR_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => setDraft((d) => ({ ...d, avatar: emoji }))}
                              className="w-9 h-9 rounded-full flex items-center justify-center text-lg transition-all"
                              style={{
                                  background: draft.avatar === emoji ? "rgba(139,92,246,0.35)" : "rgba(148,163,184,0.14)",
                                border: draft.avatar === emoji ? "2px solid #a78bfa" : "1.5px solid transparent",
                              }}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Field label="Name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="Your name" />
                      <Field label="Email" value={draft.email} onChange={(v) => setDraft((d) => ({ ...d, email: v }))} placeholder="your@email.com" type="email" />
                      <div>
                        <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">Bio</p>
                        <textarea
                          value={draft.bio}
                          onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
                          placeholder="Tell us about yourself..."
                          rows={3}
                          className="w-full rounded-xl px-3 py-2 text-xs resize-none outline-none bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white/85 placeholder-slate-400 dark:placeholder-white/20"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setEditing(false); setDraft(profile); }}
                          className="flex-1 py-2 rounded-xl text-xs text-slate-600 dark:text-white/40 bg-slate-100 dark:bg-white/5"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={saveProfile}
                          className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                          style={{ background: "linear-gradient(135deg, #7c3aed, #2563eb)" }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Logout — always bottom */}
            <div className="border-t border-gray-200 dark:border-white/10">
              <button
                onClick={handleLogout}
                className="w-full flex flex-row items-center gap-3 whitespace-nowrap overflow-hidden px-5 py-4 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
              >
                <span className="shrink-0">🚪</span>
                <span className="font-medium truncate">Log Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex flex-row items-center gap-3 whitespace-nowrap overflow-hidden px-5 py-3.5 text-sm text-slate-700 dark:text-white/75 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
    >
      <span className="text-base shrink-0">{icon}</span>
      <span className="font-medium truncate">{label}</span>
    </button>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <p className="text-[10px] text-slate-500 dark:text-white/40 uppercase tracking-widest mb-1.5">{label}</p>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl px-3 py-2 text-xs outline-none bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-900 dark:text-white/85 placeholder-slate-400 dark:placeholder-white/20"
      />
    </div>
  );
}

