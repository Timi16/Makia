import { CookieSerializeOptions } from "@fastify/cookie";
import { FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { UserRole } from "@prisma/client";
import { z } from "zod";

import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";
import { AppError } from "../middleware/errorHandler";

const registerSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(120),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
});

const accessTokenExpiresIn = "15m";
const refreshTokenExpiresIn = "7d";
const refreshTokenMaxAgeSeconds = 7 * 24 * 60 * 60;
const bcryptRounds = 12;

export const refreshCookieName = "refreshToken";

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

interface TokenPayload extends AuthenticatedUser {
  sessionId?: string;
  type: "access" | "refresh";
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
}

interface RefreshTokenPayload extends AuthenticatedUser {
  sessionId: string;
}

function getJwtSecrets() {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new AppError(500, "JWT secrets are not configured");
  }

  return { accessSecret, refreshSecret };
}

function toPublicUser(user: AuthenticatedUser): AuthenticatedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function assertUserRole(user: AuthenticatedUser, expectedRole: UserRole) {
  if (user.role !== expectedRole) {
    throw new AppError(
      403,
      expectedRole === UserRole.ADMIN
        ? "Admin access required"
        : "Please sign in with a user account"
    );
  }
}

function getRefreshCookieOptions(): CookieSerializeOptions {
  const options: CookieSerializeOptions = {
    httpOnly: true,
    maxAge: refreshTokenMaxAgeSeconds,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  };

  if (process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN !== "localhost") {
    options.domain = process.env.COOKIE_DOMAIN;
  }

  return options;
}

function getRefreshSessionKey(sessionId: string) {
  return `auth:refresh:${sessionId}`;
}

export function setRefreshCookie(reply: FastifyReply, refreshToken: string) {
  reply.setCookie(refreshCookieName, refreshToken, getRefreshCookieOptions());
}

export function clearRefreshCookie(reply: FastifyReply) {
  reply.clearCookie(refreshCookieName, {
    path: "/",
    domain:
      process.env.COOKIE_DOMAIN && process.env.COOKIE_DOMAIN !== "localhost"
        ? process.env.COOKIE_DOMAIN
        : undefined,
  });
}

export class AuthService {
  public async register(input: unknown): Promise<AuthResponse> {
    const payload = registerSchema.parse(input);
    const existingUser = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (existingUser) {
      throw new AppError(409, "Email already registered");
    }

    const passwordHash = await bcrypt.hash(payload.password, bcryptRounds);
    const user = await prisma.user.create({
      data: {
        email: payload.email.toLowerCase(),
        name: payload.name,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return this.issueTokens(user);
  }

  public async login(input: unknown, options: { expectedRole?: UserRole } = {}): Promise<AuthResponse> {
    const payload = loginSchema.parse(input);
    const user = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
    });

    if (!user) {
      throw new AppError(401, "Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(payload.password, user.passwordHash);

    if (!passwordMatches) {
      throw new AppError(401, "Invalid email or password");
    }

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };

    if (options.expectedRole) {
      assertUserRole(authUser, options.expectedRole);
    }

    return this.issueTokens(authUser);
  }

  public async refresh(refreshToken: string | undefined): Promise<RefreshResponse> {
    if (!refreshToken) {
      throw new AppError(401, "Refresh token is required");
    }

    const payload = this.verifyRefreshToken(refreshToken);
    await this.assertRefreshSession(payload, refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      throw new AppError(401, "Invalid refresh token");
    }

    await this.revokeRefreshSession(payload.sessionId!);

    return this.issueTokens(user);
  }

  public async logout(refreshToken: string | undefined) {
    if (!refreshToken) {
      return;
    }

    const payload = this.verifyRefreshToken(refreshToken);

    await this.revokeRefreshSession(payload.sessionId!);
  }

  public verifyAccessToken(token: string): AuthenticatedUser {
    const { accessSecret } = getJwtSecrets();

    try {
      const decoded = jwt.verify(token, accessSecret) as TokenPayload;

      if (decoded.type !== "access") {
        throw new AppError(401, "Invalid access token");
      }

      return toPublicUser(decoded);
    } catch (error) {
      throw new AppError(401, "Invalid access token", error);
    }
  }

  private verifyRefreshToken(token: string): RefreshTokenPayload {
    const { refreshSecret } = getJwtSecrets();

    try {
      const decoded = jwt.verify(token, refreshSecret) as TokenPayload;

      if (decoded.type !== "refresh" || !decoded.sessionId) {
        throw new AppError(401, "Invalid refresh token");
      }

      return {
        ...toPublicUser(decoded),
        sessionId: decoded.sessionId,
      };
    } catch (error) {
      throw new AppError(401, "Invalid refresh token", error);
    }
  }

  private async issueTokens(user: AuthenticatedUser): Promise<AuthResponse> {
    const sessionId = randomUUID();
    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user, sessionId);
    await this.persistRefreshSession(user.id, sessionId, refreshToken);

    return {
      accessToken,
      refreshToken,
      user: toPublicUser(user),
    };
  }

  private signAccessToken(user: AuthenticatedUser) {
    const { accessSecret } = getJwtSecrets();

    return jwt.sign(
      {
        ...toPublicUser(user),
        type: "access",
      },
      accessSecret,
      {
        expiresIn: accessTokenExpiresIn,
        subject: user.id,
      }
    );
  }

  private signRefreshToken(user: AuthenticatedUser, sessionId: string) {
    const { refreshSecret } = getJwtSecrets();

    return jwt.sign(
      {
        ...toPublicUser(user),
        sessionId,
        type: "refresh",
      },
      refreshSecret,
      {
        expiresIn: refreshTokenExpiresIn,
        subject: user.id,
      }
    );
  }

  private async persistRefreshSession(userId: string, sessionId: string, refreshToken: string) {
    await redis.set(
      getRefreshSessionKey(sessionId),
      JSON.stringify({
        refreshToken,
        userId,
      }),
      "EX",
      refreshTokenMaxAgeSeconds
    );
  }

  private async assertRefreshSession(
    payload: RefreshTokenPayload,
    refreshToken: string
  ) {
    const session = await redis.get(getRefreshSessionKey(payload.sessionId));

    if (!session) {
      throw new AppError(401, "Refresh session expired or revoked");
    }

    const parsed = JSON.parse(session) as {
      refreshToken: string;
      userId: string;
    };

    if (parsed.refreshToken !== refreshToken || parsed.userId !== payload.id) {
      throw new AppError(401, "Refresh session expired or revoked");
    }
  }

  private async revokeRefreshSession(sessionId: string) {
    await redis.del(getRefreshSessionKey(sessionId));
  }
}

export const authService = new AuthService();
