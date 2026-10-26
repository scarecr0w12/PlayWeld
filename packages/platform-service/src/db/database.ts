import {
  DatabaseSync,
  type SQLInputValue,
  type SQLOutputValue,
  type StatementSync,
} from 'node:sqlite';

export class Statement {
  constructor(private readonly statement: StatementSync) {}

  run(...params: SQLInputValue[]): unknown {
    return this.statement.run(...params);
  }

  get<T = Record<string, SQLOutputValue>>(...params: SQLInputValue[]): T | undefined {
    return this.statement.get(...params) as T | undefined;
  }

  all<T = Record<string, SQLOutputValue>>(...params: SQLInputValue[]): T[] {
    return this.statement.all(...params) as T[];
  }

  *iterate<T = Record<string, SQLOutputValue>>(...params: SQLInputValue[]): IterableIterator<T> {
    for (const row of this.statement.iterate(...params)) yield row as T;
  }
}

export class Database {
  private constructor(private readonly database: DatabaseSync) {}

  static open(databasePath: string, options: { readOnly?: boolean } = {}): Database {
    const database = new DatabaseSync(databasePath, { readOnly: options.readOnly ?? false });
    try {
      if (databasePath !== ':memory:' && !options.readOnly) {
        database.exec('PRAGMA journal_mode=WAL');
      }
      database.exec('PRAGMA foreign_keys=ON');
      database.exec('PRAGMA busy_timeout=5000');
      return new Database(database);
    } catch (error) {
      database.close();
      throw error;
    }
  }

  exec(sql: string): void {
    this.database.exec(sql);
  }

  prepare(sql: string): Statement {
    return new Statement(this.database.prepare(sql));
  }

  transaction<T>(fn: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  snapshotTo(destinationPath: string): void {
    this.database.prepare('VACUUM INTO ?').run(destinationPath);
  }

  close(): void {
    this.database.close();
  }
}
