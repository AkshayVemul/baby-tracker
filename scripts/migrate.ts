/**
 * Applies the SQL files in supabase/migrations to the database in SUPABASE_DB_URL, in filename order.
 * Each file runs once, inside a transaction, and is recorded in `migrations.applied` (a schema the
 * Supabase API doesn't expose), so re-running only applies new files.
 *
 *   pnpm db:migrate            apply pending migrations
 *   pnpm db:migrate --status   list applied and pending without changing anything
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import postgres from 'postgres'

const DIR = join(import.meta.dirname, '..', 'supabase', 'migrations')
/** Run by hand before this script existed; recorded instead of re-run when its tables are already there. */
const BASELINE = '0001_init.sql'

const url = process.env.SUPABASE_DB_URL
if (!url) {
  const where = process.env.CI
    ? 'Add it as a repository secret: GitHub → Settings → Secrets and variables → Actions → Secrets.'
    : 'Add it to .env.local.'
  console.error(
    `SUPABASE_DB_URL is not set. ${where}\n` +
      '  Value: Supabase dashboard → Connect → Session pooler → copy the URI and fill in your database password.',
  )
  process.exit(1)
}

const sql = postgres(url, { max: 1, onnotice: () => {}, connect_timeout: 15 })

try {
  await sql`create schema if not exists migrations`
  await sql`create table if not exists migrations.applied (name text primary key, applied_at timestamptz not null default now())`

  const statusOnly = process.argv.includes('--status')
  const applied = new Set((await sql<{ name: string }[]>`select name from migrations.applied`).map((r) => r.name))
  if (applied.size === 0) {
    const [{ exists }] = await sql<{ exists: boolean }[]>`select to_regclass('public.entries') is not null as exists`
    if (exists) {
      if (!statusOnly) await sql`insert into migrations.applied (name) values (${BASELINE})`
      applied.add(BASELINE)
      const note = statusOnly ? 'it will be recorded as applied on the next run' : 'recorded it as applied'
      console.log(`• ${BASELINE} is already in the database (run by hand earlier); ${note}.`)
    }
  }

  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort()
  const pending = files.filter((f) => !applied.has(f))

  if (statusOnly) {
    for (const f of files) console.log(`${applied.has(f) ? '✓ applied' : '… pending'}  ${f}`)
  } else if (pending.length === 0) {
    console.log('Database is up to date.')
  } else {
    for (const file of pending) {
      const body = await readFile(join(DIR, file), 'utf8')
      // One transaction per file: if any statement fails, none of that file is applied or recorded.
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(body)
          await tx`insert into migrations.applied (name) values (${file})`
        })
      } catch (error) {
        throw new Error(`${file}: ${(error as Error).message}`)
      }
      console.log(`✓ ${file}`)
    }
    console.log(`Applied ${pending.length} migration${pending.length === 1 ? '' : 's'}.`)
  }
} catch (error) {
  console.error(`✗ Migration failed: ${(error as Error).message}`)
  process.exitCode = 1
} finally {
  await sql.end()
}
