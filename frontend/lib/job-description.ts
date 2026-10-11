"use client";

/** Session storage key for the job description pasted on the setup page. */
export const JD_STORAGE_KEY = "bbx-job-description";

/** Read (once) the job description handed over from the setup page. */
export function readJobDescription(): string | null {
  try {
    const jd = window.sessionStorage.getItem(JD_STORAGE_KEY);
    return jd?.trim() ? jd.trim().slice(0, 8000) : null;
  } catch {
    return null;
  }
}
