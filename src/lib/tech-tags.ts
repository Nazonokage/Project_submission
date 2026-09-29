import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { titles } from '@/lib/schema';

export async function getTechTags(classId: string, slotId: string): Promise<string[]> {
  // One slot-scoped query; ignore deleted titles and historical empty tags.
  const result = await db.execute(sql`
    SELECT min(btrim(tag)) AS tag
    FROM ${titles} CROSS JOIN LATERAL unnest(${titles.techStack}) AS tags(tag)
    WHERE ${titles.classId} = ${classId} AND ${titles.slotId} = ${slotId}
      AND ${titles.deletedAt} IS NULL AND btrim(tag) <> ''
    GROUP BY lower(btrim(tag)) ORDER BY lower(btrim(tag))
  `);
  return result.rows.map(row => String(row.tag));
}
