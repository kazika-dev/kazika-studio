import { query } from '../lib/db';

async function checkConversationScenes() {
  console.log('Checking conversation_scenes table...\n');

  const tableInfo = await query(`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'kazikastudio'
    AND table_name = 'conversation_scenes'
    ORDER BY ordinal_position
  `);

  console.log('Table structure:', JSON.stringify(tableInfo.rows, null, 2));

  const conversations = await query(`
    SELECT id, title, created_at
    FROM kazikastudio.conversations
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log('\nRecent conversations:', JSON.stringify(conversations.rows, null, 2));

  for (const conv of conversations.rows) {
    const scenes = await query(
      `SELECT * FROM kazikastudio.conversation_scenes WHERE conversation_id = $1 ORDER BY created_at DESC`,
      [conv.id]
    );
    console.log(`\nConversation ${conv.id} (${conv.title}): ${scenes.rowCount} scenes`);
    if (scenes.rows.length > 0) console.log('Scenes:', JSON.stringify(scenes.rows, null, 2));
  }
}

checkConversationScenes().catch((error) => {
  console.error(error);
  process.exit(1);
});
