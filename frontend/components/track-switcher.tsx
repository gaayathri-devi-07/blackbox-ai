"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, errorMessage } from "@/lib/api-client";
import { TARGET_ROLES, TRACKS, type TargetRole } from "@/lib/domain";
import type { Profile } from "@/lib/db";
import { cn } from "@/lib/utils";

/**
 * Switch target track from anywhere. The choice is saved to the profile
 * immediately; question mix, interview focus and dashboard metrics follow it.
 */
export function TrackSwitcher({ onChanged, className }: { onChanged?: (role: TargetRole) => void; className?: string }) {
  const { profile, setProfile } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState<TargetRole | null>(null);
  const current = profile?.targetRole ?? null;

  async function choose(role: TargetRole) {
    if (role === current || saving) return;
    setSaving(role);
    try {
      const res = await api<{ profile: Profile }>("/api/me", { method: "PATCH", body: { targetRole: role } });
      setProfile(res.profile);
      toast.success(`Switched to ${TRACKS[role].label}`, "Your dashboard, questions and interviews are now calibrated for this track.");
      onChanged?.(role);
    } catch (error) {
      toast.error("Couldn't switch track", errorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group inline-flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 -mx-1.5 transition-colors hover:border-border hover:bg-muted/60 focus-visible:border-ring",
          className
        )}
        aria-label="Change target track"
      >
        {saving ? <Spinner className="size-3" /> : null}
        <span>{current ? `${TRACKS[current].label} track` : "Choose a track"}</span>
        <ChevronDown className="size-3 transition-transform group-data-[state=open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Target track · saved to your profile</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {TARGET_ROLES.map((role) => (
          <DropdownMenuItem key={role} onSelect={() => void choose(role)} className="items-start gap-3 py-2">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">
              {role === current ? <Check className="size-4 text-accent" /> : null}
            </span>
            <span>
              <span className="block text-[13px] font-medium">{TRACKS[role].label}</span>
              <span className="block text-[12px] leading-4 text-muted-foreground">{TRACKS[role].summary}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
