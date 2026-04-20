import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, hashPassword } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('lm_auth_token')?.value;
  
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });
  
  const user = verifyToken(token);
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });
  
  return NextResponse.json({ authenticated: true, user: { email: user.email, role: user.role } });
}

export async function PUT(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('lm_auth_token')?.value;
  
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const user = verifyToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
     const { password } = await request.json();
     if (!password) return NextResponse.json({ error: 'Passwort fehlt' }, { status: 400 });

     const hashed = await hashPassword(password);
     await query('UPDATE livingmatch_users SET password_hash = $1 WHERE id = $2', [hashed, user.userId]);

     return NextResponse.json({ message: 'Passwort erfolgreich geändert.' });
  } catch (err) {
     return NextResponse.json({ error: 'Fehler beim Update' }, { status: 500 });
  }
}
