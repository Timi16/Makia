import { CookieSerializeOptions } from "@fastify/cookie";
import { FastifyReply } from "fastify";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { prisma } from "../lib/prisma";
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
}

interface TokenPayload extends AuthenticatedUser {
  type: "access" | "refresh";
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthenticatedUser;
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
  };
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
      },
    });

    return this.issueTokens(user);
  }

  public async login(input: unknown): Promise<AuthResponse> {
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

    return this.issueTokens({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  }

  public async refresh(refreshToken: string | undefined) {
    if (!refreshToken) {
      throw new AppError(401, "Refresh token is required");
    }

    const payload = this.verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      throw new AppError(401, "Invalid refresh token");
    }

    return {
      accessToken: this.signAccessToken(user),
      user: toPublicUser(user),
    };
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

  private verifyRefreshToken(token: string): AuthenticatedUser {
    const { refreshSecret } = getJwtSecrets();

    try {
      const decoded = jwt.verify(token, refreshSecret) as TokenPayload;

      if (decoded.type !== "refresh") {
        throw new AppError(401, "Invalid refresh token");
      }

      return toPublicUser(decoded);
    } catch (error) {
      throw new AppError(401, "Invalid refresh token", error);
    }
  }

  private issueTokens(user: AuthenticatedUser): AuthResponse {
    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user);

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

  private signRefreshToken(user: AuthenticatedUser) {
    const { refreshSecret } = getJwtSecrets();

    return jwt.sign(
      {
        ...toPublicUser(user),
        type: "refresh",
      },
      refreshSecret,
      {
        expiresIn: refreshTokenExpiresIn,
        subject: user.id,
      }
    );
  }
}

export const authService = new AuthService();
