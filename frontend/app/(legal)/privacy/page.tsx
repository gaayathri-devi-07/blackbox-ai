import type { Metadata } from "next";
import Link from "next/link";
import { LegalHeading, LegalSection, SupportContact } from "../legal-ui";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What Blackbox collects, why, where it is processed and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <article>
      <LegalHeading title="Privacy Policy" updated="10 October 2026" />

      <LegalSection title="What we collect">
        <p>
          <strong>Account details</strong> — your name, email address or phone number, and the identifier issued by the
          sign-in provider you choose (Google, GitHub or phone verification through Firebase Authentication).
        </p>
        <p>
          <strong>Preparation data</strong> — your target track, experience level and focus areas; the text of your interview
          and group-discussion turns; scores, rubric feedback and reports; practice answers, progress and coach conversations;
          project descriptions or code you submit for review; job descriptions you paste to tailor an interview; and the
          preparation plans the planning assistant writes for you.
        </p>
        <p>
          <strong>Delivery metrics</strong> — during a mock interview, the camera feed is analysed on your device to estimate
          eye contact, posture and expression. Video frames never leave your browser; only the resulting summary numbers are
          stored with the session.
        </p>
      </LegalSection>

      <LegalSection title="How it is used">
        <p>
          Solely to run your preparation: generating questions, scoring answers, building your dashboard and recommending what
          to practise next. We do not sell your data, use it for advertising, or share it with recruiters or employers.
        </p>
      </LegalSection>

      <LegalSection title="Processors">
        <p>
          <strong>Google Firebase</strong> handles authentication. <strong>Google Gemini</strong>, when enabled, receives the text
          of your answers and discussion turns to generate questions and feedback. Speech recognition uses your browser&apos;s
          built-in speech service for live captions; in Chrome and Edge this sends microphone audio to the browser vendor. The
          accurate transcript of each answer is produced by Whisper running on your own device, so that recording never
          leaves your computer (unless Gemini transcription is enabled for this deployment).
          Account and preparation data are stored in a PostgreSQL database operated for this deployment. When the operator
          enables <strong>LangSmith</strong> for quality monitoring, it receives masked copies of AI requests and responses.
        </p>
      </LegalSection>

      <LegalSection title="AI safeguards">
        <p>
          <strong>Masking before AI.</strong> Before any text is sent to an AI model or a monitoring service, email addresses,
          phone numbers, Aadhaar and PAN numbers, payment card numbers, API keys and your name are replaced with placeholders such
          as [EMAIL_1]. The originals stay on our server and are restored only in the reply shown to you.
        </p>
        <p>
          <strong>Audit log.</strong> Each AI call is logged with the feature, outcome, timing and the number of values masked —
          never the text itself — so usage can be reviewed. You can see these counts under{" "}
          <Link href="/settings#privacy" className="text-foreground underline underline-offset-4">
            Settings → Privacy &amp; AI
          </Link>
          .
        </p>
        <p>
          <strong>Your answers are data, not instructions.</strong> Text in an answer, project write-up or job description cannot
          change how the AI scores you; attempts to do so are flagged.
        </p>
        <p>
          <strong>Offline mode.</strong> When live AI is not configured or unreachable, Blackbox uses its curated question bank
          and rule-based scoring, and nothing you type is sent to an AI provider.
        </p>
      </LegalSection>

      <LegalSection title="Retention and deletion">
        <p>
          Data is kept for as long as your account exists. You can delete your account at any time from{" "}
          <Link href="/settings#danger" className="text-foreground underline underline-offset-4">
            Settings
          </Link>
          ; this immediately and permanently removes your profile and every interview, discussion, practice and coach record
          linked to it.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Every request is authenticated with a short-lived token verified on the server, traffic is served over HTTPS in
          production, and access to your records is scoped to your account.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <SupportContact />
      </LegalSection>
    </article>
  );
}
