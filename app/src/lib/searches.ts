import { query } from './db';
import { SearchSettings } from '../types/property';

export interface SavedSearch {
  id: number;
  user_id: number;
  name: string;
  filter_settings: SearchSettings;
  last_check: string;
  is_active: boolean;
  created_at: string;
}

export async function getSearchesForUser(userId: number): Promise<SavedSearch[]> {
  const { rows } = await query(
    'SELECT * FROM livingmatch_searches WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at DESC',
    [userId]
  );
  return rows;
}

export async function saveSearch(userId: number, settings: SearchSettings, name?: string) {
  const searchName = name || `${settings.intent === 'rent' ? 'Miete' : 'Kauf'} in ${settings.locations.join(', ')}`;
  const { rows } = await query(
    'INSERT INTO livingmatch_searches (user_id, name, filter_settings) VALUES ($1, $2, $3) RETURNING id',
    [userId, searchName, JSON.stringify(settings)]
  );
  return rows[0].id;
}

export async function deleteSearch(id: number, userId: number) {
  await query('DELETE FROM livingmatch_searches WHERE id = $1 AND user_id = $2', [id, userId]);
}

export async function updateLastCheck(id: number) {
  await query('UPDATE livingmatch_searches SET last_check = CURRENT_TIMESTAMP WHERE id = $1', [id]);
}

export async function getAllActiveSearches(): Promise<(SavedSearch & { email: string })[]> {
  const { rows } = await query(
    'SELECT s.*, u.email FROM livingmatch_searches s JOIN livingmatch_users u ON s.user_id = u.id WHERE s.is_active = TRUE'
  );
  return rows;
}
