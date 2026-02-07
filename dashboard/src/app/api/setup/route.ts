import { NextRequest, NextResponse } from "next/server";
import { getUserCount } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { createSession } from "@/lib/auth/session";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  isValidUsernameFormat,
} from "@/lib/auth/validation";
import { prisma } from "@/lib/db";
import { generateApiKey } from "@/lib/api-keys/generate";
import { syncKeysToCliProxyApi } from "@/lib/api-keys/sync";

export async function POST(request: NextRequest) {
  try {
    const userCount = await getUserCount();
    
    if (userCount > 0) {
      return NextResponse.json(
        { error: "Setup already completed" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Invalid input types" },
        { status: 400 }
      );
    }

    if (
      username.length < USERNAME_MIN_LENGTH ||
      username.length > USERNAME_MAX_LENGTH ||
      !isValidUsernameFormat(username)
    ) {
      return NextResponse.json(
        {
          error: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} chars and contain only letters, numbers, _ or -`,
        },
        { status: 400 }
      );
    }

    if (
      password.length < PASSWORD_MIN_LENGTH ||
      password.length > PASSWORD_MAX_LENGTH
    ) {
      return NextResponse.json(
        {
          error: `Password must be between ${PASSWORD_MIN_LENGTH} and ${PASSWORD_MAX_LENGTH} characters`,
        },
        { status: 400 }
      );
    }

     const passwordHash = await hashPassword(password);
     
     // Create user and API key in single transaction
     const { user, apiKey } = await prisma.$transaction(async (tx) => {
       // Create first user as admin
       const newUser = await tx.user.create({
         data: {
           username,
           passwordHash,
           isAdmin: true, // First user is admin
         },
       });

       // Generate and create API key
       const generatedKey = generateApiKey();
       await tx.userApiKey.create({
         data: {
           userId: newUser.id,
           key: generatedKey,
           name: "Initial Setup Key",
         },
       });

       return { user: newUser, apiKey: generatedKey };
     });

     // Sync keys to CLIProxyAPI (fire and forget, don't block response)
     syncKeysToCliProxyApi().catch((err) => {
       console.error("Failed to sync keys after setup:", err);
     });

     const token = await signToken({
       userId: user.id,
       username: user.username,
     });

     await createSession(
       { userId: user.id, username: user.username },
       token
     );

     return NextResponse.json(
       {
         success: true,
         user: {
           id: user.id,
           username: user.username,
         },
         apiKey,
       },
       { status: 201 }
     );
  } catch (error) {
    console.error("Setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const userCount = await getUserCount();
    
    return NextResponse.json({
      setupRequired: userCount === 0,
    });
  } catch (error) {
    console.error("Setup check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
