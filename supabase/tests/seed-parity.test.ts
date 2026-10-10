import { describe, expect, it } from 'vitest';
import { DEMO_SNIPPETS, DEMO_USERS } from '../../apps/web/src/backend/demoData';
import { withTx } from './db';

// The mock backend ships its own copy of the demo data so the app works with
// no Supabase at all. This keeps that copy identical to supabase/seed.sql.
describe('mock demo data matches seed.sql', () => {
  it('has the same users', async () => {
    await withTx(async (tx) => {
      const rows = await tx.rows<{
        id: string;
        email: string;
        display_name: string;
        is_demo: boolean;
      }>(
        `select u.id, u.email, p.display_name, p.is_demo
         from auth.users u join public.profiles p on p.id = u.id
         where u.id = any($1) order by u.id`,
        [DEMO_USERS.map((u) => u.id)],
      );
      expect(rows).toEqual(
        [...DEMO_USERS]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((u) => ({
            id: u.id,
            email: u.email,
            display_name: u.displayName,
            is_demo: u.isDemo,
          })),
      );
    });
  });

  it('has the same snippets', async () => {
    await withTx(async (tx) => {
      const rows = await tx.rows(
        `select id, owner_id, title, description, language, tags, visibility, code
         from public.snippets where owner_id = any($1) order by id`,
        [DEMO_USERS.map((u) => u.id)],
      );
      expect(rows).toEqual(
        [...DEMO_SNIPPETS]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((s) => ({
            id: s.id,
            owner_id: s.ownerId,
            title: s.title,
            description: s.description,
            language: s.language,
            tags: s.tags,
            visibility: s.visibility,
            code: s.code,
          })),
      );
    });
  });
});
