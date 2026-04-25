import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set('lm_auth_token', '', {
    httpOnly: true,
    expires: new Date(0), // expire immediately
    path: '/',
  });

  return NextResponse.json({ message: 'Logout erfolgreich' });
}
