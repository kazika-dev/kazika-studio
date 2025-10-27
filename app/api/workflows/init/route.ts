import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST() {
  try {
    // kazikastudioスキーマを作成
    await query(`
      CREATE SCHEMA IF NOT EXISTS kazikastudio;
    `);

    // workflowsテーブルを作成
    await query(`
      CREATE TABLE IF NOT EXISTS kazikastudio.workflows (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        nodes JSONB NOT NULL,
        edges JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // updated_atを自動更新するトリガーを作成
    await query(`
      CREATE OR REPLACE FUNCTION kazikastudio.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    await query(`
      DROP TRIGGER IF EXISTS update_workflows_updated_at ON kazikastudio.workflows;
      CREATE TRIGGER update_workflows_updated_at
        BEFORE UPDATE ON kazikastudio.workflows
        FOR EACH ROW
        EXECUTE FUNCTION kazikastudio.update_updated_at_column();
    `);

    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
    });
  } catch (error: any) {
    console.error('Database initialization error:', error);
    return NextResponse.json(
      {
        error: 'Failed to initialize database',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
