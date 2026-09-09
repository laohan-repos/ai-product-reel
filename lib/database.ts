import BetterSqlite3 from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

type SqlValue = string | number | bigint | null | Buffer;

export type DatabaseRunResult = {
  success: true;
  meta: {
    changes: number;
    last_row_id: number | bigint;
  };
};

function normalizeValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    Buffer.isBuffer(value)
  )
    return value;
  if (value instanceof Uint8Array)
    return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  throw new TypeError(`Unsupported SQLite value: ${typeof value}`);
}

export class DatabaseStatement {
  private parameters: SqlValue[] = [];

  constructor(
    private readonly statement: BetterSqlite3.Statement,
    private readonly owner: Database,
  ) {}

  bind(...values: unknown[]) {
    this.parameters = values.map(normalizeValue);
    return this;
  }

  async run(): Promise<DatabaseRunResult> {
    return this.runSync();
  }

  async first<T = Record<string, unknown>>(): Promise<T | null> {
    return (this.statement.get(...this.parameters) as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>(): Promise<{
    success: true;
    results: T[];
  }> {
    return {
      success: true,
      results: this.statement.all(...this.parameters) as T[],
    };
  }

  runSync(): DatabaseRunResult {
    const result = this.statement.run(...this.parameters);
    return {
      success: true,
      meta: {
        changes: result.changes,
        last_row_id: result.lastInsertRowid,
      },
    };
  }

  get database() {
    return this.owner;
  }
}

export class Database {
  constructor(private readonly sqlite: BetterSqlite3.Database) {}

  prepare(sql: string) {
    return new DatabaseStatement(this.sqlite.prepare(sql), this);
  }

  async batch(statements: DatabaseStatement[]) {
    const execute = this.sqlite.transaction(() =>
      statements.map((statement) => {
        if (statement.database !== this)
          throw new Error('Cannot batch statements from another database');
        return statement.runSync();
      }),
    );
    return execute();
  }
}

const globalDatabase = globalThis as typeof globalThis & {
  __aiProductReelDatabase?: Database;
};

export function getDatabase(): Database {
  if (globalDatabase.__aiProductReelDatabase)
    return globalDatabase.__aiProductReelDatabase;

  const configuredPath = process.env.SQLITE_PATH?.trim();
  const databasePath = configuredPath
    ? path.resolve(configuredPath)
    : path.join(process.cwd(), '.data', 'ai-product-reel.sqlite');
  mkdirSync(path.dirname(databasePath), { recursive: true });

  const sqlite = new BetterSqlite3(databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');

  const database = new Database(sqlite);
  globalDatabase.__aiProductReelDatabase = database;
  return database;
}
