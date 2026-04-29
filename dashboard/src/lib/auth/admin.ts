import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";

/**
 * Returns true when the user owns an admin account.
 *
 * The session payload deliberately omits `isAdmin` so a single source of truth
 * (the `users` table) governs privilege checks. Callers that need to gate
 * privileged actions like sharing custom providers globally should consult
 * this helper after `verifySession()` succeeds.
 *
 * Wrapped in React `cache` so multiple checks within the same request reuse
 * one Prisma round-trip.
 */
export const isUserAdmin = cache(async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true },
  });
  return user?.isAdmin === true;
});
