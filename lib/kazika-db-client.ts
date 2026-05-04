/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from '@/auth';
import { query } from '@/lib/db';

type Filter = { column: string; value: unknown; operator: 'eq' | 'in' };

class PgQueryBuilder {
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private columns = '*';
  private rows: Record<string, unknown> | Record<string, unknown>[] | null = null;
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private maxRows: number | null = null;
  private offsetRows = 0;
  private singleRow = false;
  private head = false;
  private countMode: string | null = null;
  private wantsSelect = false;

  constructor(private table: string) {}

  select(columns = '*', options?: { count?: string; head?: boolean }) {
    this.columns = columns;
    this.head = Boolean(options?.head);
    this.countMode = options?.count || null;
    if (this.action === 'insert' || this.action === 'update') {
      this.wantsSelect = true;
    } else {
      this.action = 'select';
    }
    return this;
  }

  insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
    this.action = 'insert';
    this.rows = rows;
    return this;
  }

  update(row: Record<string, unknown>) {
    this.action = 'update';
    this.rows = row;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value, operator: 'eq' });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, value: values, operator: 'in' });
    return this;
  }

  range(from: number, to: number) {
    this.maxRows = Math.max(0, to - from + 1);
    this.offsetRows = Math.max(0, from);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(count: number) {
    this.maxRows = count;
    return this;
  }

  single() {
    this.singleRow = true;
    this.maxRows = 1;
    return this;
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private tableName() {
    if (!/^[a-zA-Z0-9_]+$/.test(this.table)) {
      throw new Error(`Invalid table name: ${this.table}`);
    }
    return `kazikastudio.${this.table}`;
  }

  private whereClause(values: unknown[]) {
    if (this.filters.length === 0) return '';
    const clauses = this.filters.map((filter) => {
      if (!/^[a-zA-Z0-9_]+$/.test(filter.column)) {
        throw new Error(`Invalid column name: ${filter.column}`);
      }
      if (filter.operator === 'in') {
        const list = Array.isArray(filter.value) ? filter.value : [];
        if (list.length === 0) return 'FALSE';
        const placeholders = list.map((item) => {
          values.push(item);
          return `$${values.length}`;
        });
        return `${filter.column} IN (${placeholders.join(', ')})`;
      }
      values.push(filter.value);
      return `${filter.column} = $${values.length}`;
    });
    return ` WHERE ${clauses.join(' AND ')}`;
  }

  private async execute() {
    try {
      if (this.action === 'select') return await this.executeSelect();
      if (this.action === 'insert') return await this.executeInsert();
      if (this.action === 'update') return await this.executeUpdate();
      return await this.executeDelete();
    } catch (error) {
      return { data: null, error: error instanceof Error ? error : new Error(String(error)), count: null };
    }
  }

  private selectColumns() {
    // Relationship shorthand like `*, studios(id, name)` is not plain SQL.
    // Until those routes are fully query-native, return the base table columns.
    return this.columns.includes('(') ? '*' : this.columns;
  }

  private async executeSelect() {
    const values: unknown[] = [];
    let sql = `SELECT ${this.head ? 'COUNT(*)::int AS count' : this.selectColumns()} FROM ${this.tableName()}`;
    sql += this.whereClause(values);
    if (!this.head && this.orderBy) {
      sql += ` ORDER BY ${this.orderBy.column} ${this.orderBy.ascending ? 'ASC' : 'DESC'}`;
    }
    if (!this.head && this.maxRows) {
      sql += ` LIMIT ${this.maxRows}`;
    }
    if (!this.head && this.offsetRows) {
      sql += ` OFFSET ${this.offsetRows}`;
    }

    const result = await query(sql, values);
    if (this.head) {
      return { data: null, error: null, count: result.rows[0]?.count ?? 0 };
    }
    const data = this.singleRow ? (result.rows[0] ?? null) : result.rows;
    return { data, error: null, count: this.countMode ? result.rowCount : null };
  }

  private async executeInsert() {
    const rows = Array.isArray(this.rows) ? this.rows : [this.rows || {}];
    if (rows.length === 0) return { data: [], error: null, count: 0 };
    const columns = Object.keys(rows[0]);
    const values: unknown[] = [];
    const valueGroups = rows.map((row) => {
      const placeholders = columns.map((column) => {
        values.push((row as Record<string, unknown>)[column]);
        return `$${values.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });
    const returning = this.wantsSelect ? ` RETURNING ${this.selectColumns()}` : ' RETURNING *';
    const sql = `INSERT INTO ${this.tableName()} (${columns.join(', ')}) VALUES ${valueGroups.join(', ')}${returning}`;
    const result = await query(sql, values);
    return { data: this.singleRow ? result.rows[0] : result.rows, error: null, count: result.rowCount };
  }

  private async executeUpdate() {
    const row = (this.rows || {}) as Record<string, unknown>;
    const values: unknown[] = [];
    const assignments = Object.keys(row).map((column) => {
      values.push(row[column]);
      return `${column} = $${values.length}`;
    });
    let sql = `UPDATE ${this.tableName()} SET ${assignments.join(', ')}`;
    sql += this.whereClause(values);
    sql += this.wantsSelect ? ` RETURNING ${this.selectColumns()}` : ' RETURNING *';
    const result = await query(sql, values);
    return { data: this.singleRow ? result.rows[0] : result.rows, error: null, count: result.rowCount };
  }

  private async executeDelete() {
    const values: unknown[] = [];
    let sql = `DELETE FROM ${this.tableName()}`;
    sql += this.whereClause(values);
    const result = await query(sql, values);
    return { data: null, error: null, count: result.rowCount };
  }
}

export async function createKazikaClient(): Promise<any> {
  return {
    auth: {
      async getUser() {
        const session = await auth();
        const user = session?.user
          ? { id: session.user.id, email: session.user.email || null }
          : null;
        return { data: { user }, error: null };
      },
    },
    from(table: string) {
      return new PgQueryBuilder(table);
    },
  };
}
