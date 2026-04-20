import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { getSearchesForUser, saveSearch, deleteSearch } from '@/lib/searches';

export async function GET() {
  const cookieStore = cookies();
  const token = cookieStore.get('lm_auth_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = verifyToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const searches = await getSearchesForUser(user.userId);
    return NextResponse.json({ searches });
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Laden der Suchen' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieStore = cookies();
  const token = cookieStore.get('lm_auth_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = verifyToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { settings, name } = await request.json();
    if (!settings || !settings.locations || settings.locations.length === 0) {
      return NextResponse.json({ error: 'Ungültige Sucheinstellungen' }, { status: 400 });
    }

    const searchId = await saveSearch(user.userId, settings, name);
    return NextResponse.json({ success: true, searchId });
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Speichern der Suche' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const cookieStore = cookies();
  const token = cookieStore.get('lm_auth_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = verifyToken(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID fehlt' }, { status: 400 });

    await deleteSearch(parseInt(id, 10), user.userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Fehler beim Löschen' }, { status: 500 });
  }
}
