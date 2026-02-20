/**
 * 統一エラーハンドリング（house-osから移植・Supabase版）
 *
 * Prisma/Sentry依存を除去し、Supabaseベースに最適化
 */

import { NextResponse } from "next/server";

// ===========================================
// カスタムエラークラス
// ===========================================

export class AppError extends Error {
  constructor(
    public override message: string,
    public statusCode: number = 500,
    public code: string = "INTERNAL_ERROR",
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "認証が必要です") {
    super(message, 401, "UNAUTHORIZED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = "アクセス権限がありません") {
    super(message, 403, "FORBIDDEN");
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = "リソース") {
    super(`${resource}が見つかりません`, 404, "NOT_FOUND");
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "入力内容に誤りがあります", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "データが重複しています") {
    super(message, 409, "CONFLICT");
    this.name = "ConflictError";
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = "リクエスト回数の上限に達しました") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
    this.name = "RateLimitError";
  }
}

// ===========================================
// エラーレスポンス生成
// ===========================================

interface ErrorResponseBody {
  error: string;
  code: string;
  details?: unknown;
  timestamp: string;
}

export function createErrorResponse(error: unknown): NextResponse<ErrorResponseBody> {
  const timestamp = new Date().toISOString();

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details, timestamp },
      { status: error.statusCode }
    );
  }

  // Supabaseエラー（PostgrestError相当）
  if (isSupabaseError(error)) {
    return handleSupabaseError(error, timestamp);
  }

  if (error instanceof Error) {
    const isProduction = process.env.NODE_ENV === "production";
    return NextResponse.json(
      {
        error: isProduction ? "サーバーエラーが発生しました" : error.message,
        code: "INTERNAL_ERROR",
        details: isProduction ? undefined : error.stack,
        timestamp,
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: "予期しないエラーが発生しました", code: "UNKNOWN_ERROR", timestamp },
    { status: 500 }
  );
}

// ===========================================
// Supabaseエラーハンドリング
// ===========================================

interface SupabaseError {
  code: string;
  message: string;
  details?: string;
}

function isSupabaseError(error: unknown): error is SupabaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as SupabaseError).code === "string"
  );
}

function handleSupabaseError(error: SupabaseError, timestamp: string): NextResponse<ErrorResponseBody> {
  // PostgreSQL error codes
  switch (error.code) {
    case "23505": // unique_violation
      return NextResponse.json(
        { error: "このデータは既に存在します", code: "DUPLICATE_ENTRY", timestamp },
        { status: 409 }
      );
    case "23503": // foreign_key_violation
      return NextResponse.json(
        { error: "関連するデータが見つかりません", code: "FOREIGN_KEY_ERROR", timestamp },
        { status: 400 }
      );
    case "PGRST116": // single row expected
      return NextResponse.json(
        { error: "データが見つかりません", code: "NOT_FOUND", timestamp },
        { status: 404 }
      );
    case "42501": // insufficient_privilege (RLS)
      return NextResponse.json(
        { error: "アクセス権限がありません", code: "FORBIDDEN", timestamp },
        { status: 403 }
      );
    default:
      return NextResponse.json(
        { error: "データベースエラーが発生しました", code: `DB_ERROR_${error.code}`, timestamp },
        { status: 500 }
      );
  }
}

// ===========================================
// try-catchラッパー
// ===========================================

type AsyncHandler<T> = () => Promise<T>;

export async function tryCatch<T>(
  handler: AsyncHandler<T>,
): Promise<T | NextResponse<ErrorResponseBody>> {
  try {
    return await handler();
  } catch (error) {
    logger.error("API Error", {}, error instanceof Error ? error : new Error(String(error)));
    return createErrorResponse(error);
  }
}

// ===========================================
// ロギング
// ===========================================

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

export function log(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
  error?: Error
): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    error: error ? { name: error.name, message: error.message, stack: error.stack } : undefined,
  };

  const isProduction = process.env.NODE_ENV === "production";
  if (isProduction) {
    console[level](JSON.stringify(entry));
  } else {
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`;
    console[level](prefix, message, context || "", error || "");
  }
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => log("debug", message, context),
  info: (message: string, context?: Record<string, unknown>) => log("info", message, context),
  warn: (message: string, context?: Record<string, unknown>) => log("warn", message, context),
  error: (message: string, context?: Record<string, unknown>, error?: Error) =>
    log("error", message, context, error),
};
