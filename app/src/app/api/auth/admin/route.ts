import { NextResponse } from 'next/server';
import { query } from '../../../../lib/db';
import { hashPassword, verifyToken } from '../../../../lib/auth';
import { cookies } from 'next/headers';

// Helper to check admin access
async function checkAdminAccess() {
  const cookieStore = await cookies();
  const token = cookieStore.get('lm_auth_token')?.value;
  if (!token) return null;

  const user = verifyToken(token);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export async function GET() {
  if (!(await checkAdminAccess())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
     const { rows } = await query('SELECT id, email, role, created_at FROM livingmatch_users ORDER BY id ASC');
     return NextResponse.json({ users: rows });
  } catch (err) {
     return NextResponse.json({ error: 'DB Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await checkAdminAccess())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
     const { email, password, role } = await request.json();
     if (!email || !password) return NextResponse.json({ error: 'Email und Passwort benötigt' }, { status: 400 });

     const hashed = await hashPassword(password);
     await query('INSERT INTO livingmatch_users (email, password_hash, role) VALUES ($1, $2, $3)', [email, hashed, role || 'user']);
     
     return NextResponse.json({ message: 'User erfolgreich erstellt.' });
  } catch (err: any) {
     if (err.code === '23505') { // postgres unique violation
        return NextResponse.json({ error: 'Diese E-Mail ist bereits registriert.' }, { status: 400 });
     }
     return NextResponse.json({ error: 'Fehler beim Erstellen des Nutzers.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await checkAdminAccess())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
     const { id, role, password } = await request.json();
     if (!id) return NextResponse.json({ error: 'ID benötigt' }, { status: 400 });

     if (role) {
        await query('UPDATE livingmatch_users SET role = $1 WHERE id = $2', [role, id]);
     }
     if (password) {
        const hashed = await hashPassword(password);
        await query('UPDATE livingmatch_users SET password_hash = $1 WHERE id = $2', [hashed, id]);
     }
     
     return NextResponse.json({ message: 'User erfolgreich aktualisiert.' });
  } catch (err) {
     return NextResponse.json({ error: 'Fehler beim Update.' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await checkAdminAccess())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
     const { searchParams } = new URL(request.url);
     const id = searchParams.get('id');
     if (!id) return NextResponse.json({ error: 'ID benötigt' }, { status: 400 });
     
     await query('DELETE FROM livingmatch_users WHERE id = $1', [parseInt(id, 10)]);
     return NextResponse.json({ message: 'User erfolgreich gelöscht.' });
  } catch (err) {
     return NextResponse.json({ error: 'Fehler beim Löschen.' }, { status: 500 });
  }
}
