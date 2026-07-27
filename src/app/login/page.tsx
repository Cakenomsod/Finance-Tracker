'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AppLogo } from '@/components/app-logo';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { FirebaseError } from 'firebase/app';

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function LoginSkeleton() {
  return (
    <Card
      className="w-full max-w-md"
      aria-busy="true"
      aria-label="Loading sign-in"
    >
      <CardHeader className="items-center text-center">
        <Skeleton className="size-10 rounded-lg motion-reduce:animate-none" />
        <div className="flex w-full flex-col items-center gap-2 pt-2">
          <Skeleton className="h-6 w-40 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-56 max-w-full motion-reduce:animate-none" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="mx-auto h-4 w-64 max-w-full motion-reduce:animate-none" />
        <Skeleton className="h-10 w-full motion-reduce:animate-none" />
      </CardContent>
      <CardFooter className="justify-center">
        <Skeleton className="h-3 w-52 motion-reduce:animate-none" />
      </CardFooter>
    </Card>
  );
}

function getSignInErrorMessage(error: unknown): string | null {
  if (!(error instanceof FirebaseError)) {
    return 'We couldn’t sign you in. Please try again.';
  }

  switch (error.code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow popups for this site and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'We couldn’t sign you in. Please try again.';
  }
}

function LoginContent() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fromParam = searchParams.get('from')
  const from =
    fromParam && fromParam !== '/login' && fromParam.startsWith('/')
      ? fromParam
      : '/'

  useEffect(() => {
    if (user && !loading) {
      router.push(from);
    }
  }, [user, loading, router, from]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      const message = getSignInErrorMessage(error);
      if (message) {
        setErrorMessage(message);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return <LoginSkeleton />;
  }

  return (
    <main className="w-full max-w-md">
      <Card className="w-full">
        <CardHeader className="items-center text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <AppLogo className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 pt-2">
            <CardTitle className="text-2xl font-semibold tracking-tight text-balance">
              Finance Tracker
            </CardTitle>
            <CardDescription className="text-pretty">
              Track spending, split costs, and settle up with friends.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Sign-in failed</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}

          <p className="text-center text-sm text-muted-foreground text-pretty">
            Sign in to open Transactions and keep your numbers straight.
          </p>

          <Button
            type="button"
            size="lg"
            className="w-full min-h-11 gap-2 transition-[opacity,box-shadow] duration-200 ease-out motion-reduce:transition-none"
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            aria-busy={isSigningIn}
          >
            {isSigningIn ? (
              <>
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <GoogleMark className="size-4" />
                <span>Continue with Google</span>
              </>
            )}
          </Button>
        </CardContent>

        <CardFooter className="justify-center">
          <p className="max-w-prose px-2 text-center text-xs text-muted-foreground text-pretty">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
      <Suspense fallback={<LoginSkeleton />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}
