require('dotenv').config();
const { Pool } = require('pg');

const connectionString = `postgresql://${process.env.SUPABASE_DB_USER}:${process.env.SUPABASE_DB_PASSWORD}@${process.env.SUPABASE_DB_HOST}:${process.env.SUPABASE_DB_PORT}/${process.env.SUPABASE_DB_NAME}`;

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    // Get workflow steps with Nanobana workflows (ID 1 or 4)
    const result = await pool.query(`
      SELECT s.id, s.workflow_id, s.input_config, w.name as workflow_name
      FROM kazikastudio.studio_board_workflow_steps s
      JOIN kazikastudio.workflows w ON s.workflow_id = w.id
      WHERE s.workflow_id IN (1, 4)
      ORDER BY s.created_at DESC
      LIMIT 3
    `);

    if (result.rows.length > 0) {
      console.log(`Found ${result.rows.length} workflow steps with Nanobana workflows:\n`);
      result.rows.forEach((step, idx) => {
        console.log(`\n=== Step ${idx + 1} ===`);
        console.log('Step ID:', step.id);
        console.log('Workflow:', step.workflow_name, `(ID: ${step.workflow_id})`);
        console.log('Input Config:');
        console.log(JSON.stringify(step.input_config, null, 2));
      });
    } else {
      console.log('No workflow steps found with Nanobana workflows (ID 1 or 4)');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

test();
