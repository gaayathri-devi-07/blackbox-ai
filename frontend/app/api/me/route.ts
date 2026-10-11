import { authedRoute, parseBody } from "@/lib/server/api";
import { deleteUserAccount, serializeProfile, updateUserProfile } from "@/lib/db";
import { profileUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

/** The signed-in user's profile. The first call provisions the database row. */
export const GET = authedRoute(async ({ user }) => ({ profile: serializeProfile(user) }));

export const PATCH = authedRoute(async ({ req, user }) => {
  const update = await parseBody(req, profileUpdateSchema, 4 * 1024);
  const updated = await updateUserProfile(user.id, update);
  return { profile: serializeProfile(updated) };
});

/** Deletes the account and all associated data. The sign-in identity itself is untouched. */
export const DELETE = authedRoute(async ({ user }) => {
  await deleteUserAccount(user.id);
  return { deleted: true };
});
