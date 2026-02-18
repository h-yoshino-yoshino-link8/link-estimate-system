import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;

  console.log("[middleware] dataSource=", dataSource, "url=", url?.slice(0, 30), "key=", key?.slice(0, 20));

  // Supabase未設定時はスキップ
  if (dataSource !== "supabase" || !url || !key) {
    console.log("[middleware] skipped: env not ready");
    return NextResponse.next();
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname.startsWith("/auth/");

    console.log("[middleware] path=", pathname, "user=", !!user, "isAuthPage=", isAuthPage);

    // 未認証 → ログインへ
    if (!user && !isAuthPage) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }

    // 認証済み → ログインページからリダイレクト
    if (user && isAuthPage) {
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }

    return supabaseResponse;
  } catch (e) {
    console.error("[middleware] error:", e);
    // エラー時はログインへリダイレクト
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
