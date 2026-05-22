import { query } from './db';

const allowedKazikaAgentTables = new Set(['assets', 'generation_jobs']);

function assertAllowedKazikaAgentTable(table: string) {
  if (!allowedKazikaAgentTables.has(table)) {
    throw new Error(`Unsupported sequence sync table: ${table}`);
  }
}

export async function syncKazikaAgentIdSequence(table: 'assets' | 'generation_jobs') {
  assertAllowedKazikaAgentTable(table);
  await query(`
    select setval(
      pg_get_serial_sequence('kazika_studio_agents.${table}', 'id'),
      coalesce((select max(id) from kazika_studio_agents.${table}), 1),
      (select max(id) is not null from kazika_studio_agents.${table})
    )
  `);
}
