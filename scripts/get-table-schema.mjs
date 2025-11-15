import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getTableSchema() {
  const tables = [
    'kazikastudio.m_camera_angles',
    'kazikastudio.m_camera_movements',
    'kazikastudio.m_shot_distances'
  ];

  for (const tableName of tables) {
    console.log(`\n=== ${tableName} ===`);

    try {
      // Get sample data to see column structure
      const { data, error } = await supabase
        .schema('kazikastudio')
        .from(tableName.replace('kazikastudio.', ''))
        .select('*')
        .limit(3);

      if (error) {
        console.error(`Error: ${error.message}`);
        console.error(`Details: ${JSON.stringify(error, null, 2)}`);
      } else {
        console.log(`Row count: ${data.length}`);
        if (data.length > 0) {
          console.log(`Columns: ${Object.keys(data[0]).join(', ')}`);
          console.log(`\nSample data:`);
          data.forEach((row, idx) => {
            console.log(`\nRow ${idx + 1}:`);
            Object.entries(row).forEach(([key, value]) => {
              const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
              console.log(`  ${key}: ${valueStr}`);
            });
          });
        } else {
          console.log('Table is empty');
          // Try to insert and delete to get error with column info
          const { error: insertError } = await supabase
            .schema('kazikastudio')
            .from(tableName.replace('kazikastudio.', ''))
            .insert({ test: 'test' })
            .select();
          if (insertError) {
            console.log('Insert error (shows column info):');
            console.log(insertError.message);
          }
        }
      }
    } catch (err) {
      console.error(`Exception: ${err.message}`);
    }
  }
}

getTableSchema().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
