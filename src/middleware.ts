import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role as string | undefined;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin") && role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL(fallback(role), req.url));
    }

    if (
      path.startsWith("/gestion") &&
      role !== "SUPER_ADMIN" &&
      role !== "GESTIONNAIRE" &&
      role !== "GESTIONNAIRE_LECTURE"
    ) {
      return NextResponse.redirect(new URL(fallback(role), req.url));
    }

    if (path.startsWith("/membre") && role !== "MEMBRE" && role !== "SUPER_ADMIN") {
      if (role === "GESTIONNAIRE" || role === "GESTIONNAIRE_LECTURE") {
        return NextResponse.redirect(new URL("/gestion", req.url));
      }
      return NextResponse.redirect(new URL(fallback(role), req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname;
        if (
          path.startsWith("/membre") ||
          path.startsWith("/gestion") ||
          path.startsWith("/admin")
        ) {
          return !!token;
        }
        return true;
      },
    },
  }
);

function fallback(role?: string) {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "GESTIONNAIRE" || role === "GESTIONNAIRE_LECTURE") return "/gestion";
  if (role === "MEMBRE") return "/membre";
  return "/login";
}

export const config = {
  matcher: ["/membre/:path*", "/gestion/:path*", "/admin/:path*"],
};
