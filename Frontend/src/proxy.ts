import { NextResponse, type NextRequest } from "next/server";
import { DEMO_SESSION_COOKIE, decodeDemoSession } from "@/lib/auth/demo";
import { isPublicPath, roleHome } from "@/lib/auth/routes";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeDemoSession(
    request.cookies.get(DEMO_SESSION_COOKIE)?.value,
  );

  if (isPublicPath(pathname)) {
    if (session && (pathname === "/login" || pathname.startsWith("/register"))) {
      const url = request.nextUrl.clone();
      url.pathname = roleHome(session.role);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/company") && session.role !== "company") {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/employee") && session.role !== "employee") {
    const url = request.nextUrl.clone();
    url.pathname = "/unauthorized";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
