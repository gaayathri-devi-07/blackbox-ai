/** Building blocks for the policy pages. */

export function LegalHeading({ title, updated }: { title: string; updated: string }) {
  return (
    <div className="border-b pb-8">
      <p className="eyebrow">Policy</p>
      <h1 className="mt-3 text-[clamp(2rem,4vw,2.75rem)] font-medium leading-tight tracking-[-0.03em]">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b py-8 last:border-0">
      <h2 className="text-[17px] font-medium tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

/** Operators set NEXT_PUBLIC_SUPPORT_EMAIL to publish a contact address on these pages. */
export function SupportContact() {
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  if (!email) return <p>Questions about this policy can be raised with the operator of this Blackbox deployment.</p>;
  return (
    <p>
      Questions about this policy:{" "}
      <a href={`mailto:${email}`} className="text-foreground underline underline-offset-4">
        {email}
      </a>
      .
    </p>
  );
}
