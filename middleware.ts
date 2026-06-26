import { NextResponse, type NextRequest, type NextFetchEvent } from 'next/server';

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * When Clerk keys are present we delegate to Clerk's middleware and protect
 * the profile route. Without keys the middleware is a no-op so the app runs
 * (and the home page renders live AniList data) with zero auth config.
 */
export default async function middleware(req: NextRequest, event: NextFetchEvent) {
  if (!hasClerk) return NextResponse.next();

  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');
  const isProtected = createRouteMatcher(['/profile(.*)']);

  const handler = clerkMiddleware(async (auth, request) => {
    if (isProtected(request)) {
      const { userId, redirectToSignIn } = await auth();
      if (!userId) return redirectToSignIn();
    }
  });

  return handler(req, event);
}

export const config = {
  matcher: ['/((?!_next|api/streams|.*\\..*).*)', '/(api|trpc)(.*)'],
};
