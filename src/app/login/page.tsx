'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function LoginContent() {
  const { user, signInWithGoogle, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const from = searchParams.get('from') || '/';

  useEffect(() => {
    if (user && !loading) {
      router.push(from);
    }
  }, [user, loading, router, from]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="size-12 animate-pulse rounded-full bg-primary/20"></div>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md border-border/40 bg-background/60 backdrop-blur-xl relative z-10">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Wallet className="size-8" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Finance</CardTitle>
          <CardDescription className="text-muted-foreground text-base">
            Personal finance operating system
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Please sign in to access your dashboard and track your finances.
          </p>
        </div>
        
        <Button 
          className="w-full h-12 text-base gap-3 shadow-md hover:shadow-lg transition-all"
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
        >
          {isSigningIn ? (
            <div className="size-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"></div>
          ) : (
            <>
              <svg className="size-5" viewBox="0 0 24 24">
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
              Continue with Google
            </>
          )}
        </Button>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 text-center">
        <p className="text-xs text-muted-foreground px-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B1020] px-4 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] size-[40%] rounded-full bg-primary/10 blur-[120px]"></div>
      <div className="absolute bottom-[-10%] right-[-10%] size-[40%] rounded-full bg-blue-500/10 blur-[120px]"></div>

      <Suspense fallback={
        <div className="flex flex-col items-center gap-4 relative z-10">
          <div className="size-12 animate-pulse rounded-full bg-primary/20"></div>
          <p className="text-sm text-muted-foreground text-white">Loading...</p>
        </div>
      }>
        <LoginContent />
      </Suspense>
      
      {/* Visual accents */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-20"></div>
    </div>
  );
}
