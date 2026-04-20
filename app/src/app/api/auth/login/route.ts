import { NextResponse } from 'next/server';
import { query, initDb } from '@/lib/db';
import { verifyPassword, signToken, seedSuperUser } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    // Seed DB and Superuser on first boot / first login attempt
    await seedSuperUser();
    
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email und Passwort erwartet.' }, { status: 400 });
    }

    const { rows } = await query('SELECT * FROM livingmatch_users WHERE email = $1', [email]);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Ungültige Zugangsdaten.' }, { status: 401 });
    }

    const user = rows[0];
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      return NextResponse.json({ error: 'Ungültige Zugangsdaten.' }, { status: 401 });
    }

    // Create session token
    const token = signToken({ userId: user.id, email: user.email, role: user.role });
    
    // Set HTTP-only cookie
    const cookieStore = await cookies();
    cookieStore.set('lm_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({ 
       message: 'Login erfolgreich', 
       user: { id: user.id, email: user.email, role: user.role } 
    });

  } catch (err: any) {
    console.error("Login Error:", err);
    return NextResponse.json({ error: 'Interner Server-Fehler' }, { status: 500 });
  }
}
