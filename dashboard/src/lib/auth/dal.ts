import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

export const getUser = cache(async (userId: string): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { id: userId },
  });
});

export const getUserByUsername = cache(async (username: string): Promise<User | null> => {
  return prisma.user.findUnique({
    where: { username },
  });
});

export async function createUser(username: string, passwordHash: string): Promise<User> {
  return prisma.user.create({
    data: {
      username,
      passwordHash,
    },
  });
}

export async function getUserCount(): Promise<number> {
  return prisma.user.count();
}
