export type StudentPickable = { id: string; name: string; email?: string | null };

export function studentMatchesPickerQuery(s: StudentPickable, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = (s.name || '').toLowerCase();
  const email = (s.email || '').toLowerCase();
  return name.includes(q) || email.includes(q);
}
