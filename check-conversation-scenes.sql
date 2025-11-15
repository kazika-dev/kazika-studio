-- Check if conversation_scenes table exists in kazikastudio schema
-- Run this in Supabase SQL Editor

-- 1. Check if the table exists
SELECT
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'kazikastudio'
AND tablename = 'conversation_scenes';

-- 2. If table exists, show its structure
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'kazikastudio'
AND table_name = 'conversation_scenes'
ORDER BY ordinal_position;

-- 3. Count rows in conversation_scenes (if it exists)
SELECT COUNT(*) as row_count
FROM kazikastudio.conversation_scenes;

-- 4. Show sample data (if any)
SELECT *
FROM kazikastudio.conversation_scenes
LIMIT 10;

-- 5. List all tables in kazikastudio schema for reference
SELECT tablename
FROM pg_tables
WHERE schemaname = 'kazikastudio'
ORDER BY tablename;

-- 6. Check recent conversations
SELECT
    id,
    title,
    created_at,
    (SELECT COUNT(*) FROM kazikastudio.conversation_messages WHERE conversation_id = c.id) as message_count
FROM kazikastudio.conversations c
ORDER BY created_at DESC
LIMIT 5;

-- 7. For each recent conversation, check if there are related scenes
SELECT
    c.id as conversation_id,
    c.title,
    COUNT(cs.id) as scene_count
FROM kazikastudio.conversations c
LEFT JOIN kazikastudio.conversation_scenes cs ON cs.conversation_id = c.id
GROUP BY c.id, c.title
ORDER BY c.created_at DESC
LIMIT 10;
