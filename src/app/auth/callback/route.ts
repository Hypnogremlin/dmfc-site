import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  // Only ever redirect to a path on this site. A bare "/x" is safe; anything
  // else (a scheme-relative "//evil.com", an absolute URL, or a value like
  // "@evil.com" that browsers/some parsers treat as a host) is rejected in
  // favor of the default. This is what stops the open-redirect: `next` is
  // attacker-controlled query input.
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/member";

  if (code) {
    // Build the redirect response first so we can attach cookies directly to
    // it. Using `next/headers` cookies() here is NOT safe: cookies written via
    // that API are not reliably merged into an explicitly-returned
    // NextResponse.redirect(), which would leave the browser with no session
    // cookie even though exchangeCodeForSession() succeeded.
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
