import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    
    if (!idToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // In a full implementation, you might want to verify the token here using firebase-admin
    // but for the middleware logic, we'll just set the cookie.
    
    const cookieStore = await cookies();
    cookieStore.set('__session', idToken, {
      maxAge: 60 * 60 * 24 * 5, // 5 days
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax',
    });

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete({
    name: '__session',
    path: '/',
  });
  return NextResponse.json({ status: 'success' });
}
