/**
 * backup-files-to-s3 — nightly copy of every uploaded file (Supabase Storage)
 * to this marae's own AWS S3 bucket, in the same region as its database.
 *
 * Why: Supabase's database backups hold only a list of the files, not the
 * files themselves, so a deleted or overwritten upload cannot be restored from
 * them. This job closes that gap. The bucket has versioning on and the backup
 * user cannot delete, so old versions stay recoverable for ~90 days.
 *
 * Modes (JSON body):
 *   {}                        copy new and changed files (nightly, ~3am NZ)
 *   { "mode": "freshness" }   alert if there has been no good run for 2 days
 *
 * Alerts go to ADMIN_ALERT_EMAIL through send-notification when a run fails,
 * any file fails to copy, or the freshness check finds the backup stale.
 *
 * Secrets (set per project in the terminal, never committed):
 *   BACKUP_AWS_KEY_ID, BACKUP_AWS_SECRET, BACKUP_BUCKET, BACKUP_REGION
 *   ADMIN_ALERT_EMAIL (already used by check-deadlines)
 *
 * Security: the gateway checks the JWT signature; this function additionally
 * requires the role claim to be service_role, so the public anon key cannot
 * trigger it.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const AWS_KEY          = Deno.env.get('BACKUP_AWS_KEY_ID') ?? '';
const AWS_SECRET       = Deno.env.get('BACKUP_AWS_SECRET') ?? '';
const BUCKET           = Deno.env.get('BACKUP_BUCKET') ?? '';
const REGION           = Deno.env.get('BACKUP_REGION') ?? '';
const ADMIN_EMAIL      = Deno.env.get('ADMIN_ALERT_EMAIL') ?? '';
const PROJECT_REF      = (SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) ?? [])[1] ?? 'unknown';

const MAX_FILE_BYTES = 40 * 1024 * 1024;   // edge functions have limited memory
const TIME_BUDGET_MS = 110 * 1000;         // stop early and carry on next night
const STALE_DAYS     = 2;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function isServiceRole(req: Request): boolean {
  try {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    // Newer projects use opaque sb_secret_ keys (not JWTs). Those need verify_jwt=false on the
    // function, so the only thing accepted is an exact match with this project's own secret key.
    if (token && token === SERVICE_ROLE_KEY) return true;
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

async function alertAdmin(subject: string, body: string) {
  if (!ADMIN_EMAIL) { console.warn(`ADMIN_ALERT_EMAIL not set, skipped alert: ${subject}`); return; }
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SERVICE_ROLE_KEY },
      body: JSON.stringify({ to: [ADMIN_EMAIL], subject, body }),
    });
  } catch (e) {
    console.error('alert send failed', e);
  }
}

type Obj = { path: string; versionKey: string; size: number };

async function listFolder(admin: any, bucket: string, prefix: string, out: Obj[]) {
  let offset = 0;
  for (;;) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        await listFolder(admin, bucket, full, out);   // a folder
      } else {
        out.push({
          path: full,
          versionKey: String(item.metadata?.eTag ?? item.updated_at ?? item.created_at ?? ''),
          size: Number(item.metadata?.size ?? 0),
        });
      }
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
}

async function freshness(admin: any) {
  const { data } = await admin.from('backup_runs').select('finished_at, status, files_failed')
    .in('status', ['ok', 'partial']).order('finished_at', { ascending: false }).limit(1);
  const last = data?.[0]?.finished_at ? new Date(data[0].finished_at) : null;
  const ageDays = last ? (Date.now() - last.getTime()) / 86400000 : Infinity;
  if (ageDays > STALE_DAYS) {
    await alertAdmin(
      `MaraeHub file backup is stale (${PROJECT_REF})`,
      `No successful file backup to S3 has finished in the last ${STALE_DAYS} days on project ${PROJECT_REF}. ` +
      (last ? `Last good run: ${last.toISOString()}.` : 'There has never been a good run.') +
      `\n\nCheck the backup-files-to-s3 function logs and the maraehub-backup-files cron job.`,
    );
    return json({ stale: true, last: last?.toISOString() ?? null });
  }
  return json({ stale: false, last: last?.toISOString() });
}

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!isServiceRole(req)) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let mode = '';
  try { mode = (await req.json())?.mode ?? ''; } catch { /* empty body */ }
  if (mode === 'freshness') return await freshness(admin);

  const missingNames = [['BACKUP_AWS_KEY_ID', AWS_KEY], ['BACKUP_AWS_SECRET', AWS_SECRET], ['BACKUP_BUCKET', BUCKET], ['BACKUP_REGION', REGION]]
    .filter(([, v]) => !v).map(([n]) => n);
  if (missingNames.length > 0) {
    await alertAdmin(`MaraeHub file backup cannot run (${PROJECT_REF})`, `These backup secrets are not set on this project: ${missingNames.join(', ')}.`);
    return json({ error: 'Backup secrets missing', missing: missingNames }, 500);
  }

  const aws = new AwsClient({ accessKeyId: AWS_KEY, secretAccessKey: AWS_SECRET, service: 's3', region: REGION });
  const started = Date.now();
  const { data: run } = await admin.from('backup_runs').insert({ status: 'running' }).select('id').single();
  const runId = run?.id;

  let copied = 0, failed = 0, skippedLarge = 0, bytes = 0, scanned = 0, partial = false;
  const problems: string[] = [];

  try {
    const { data: buckets, error: bErr } = await admin.storage.listBuckets();
    if (bErr) throw new Error(`listBuckets: ${bErr.message}`);

    outer:
    for (const b of buckets ?? []) {
      const objs: Obj[] = [];
      await listFolder(admin, b.name, '', objs);
      scanned += objs.length;

      const { data: done } = await admin.from('backup_file_log').select('object_path, version_key').eq('bucket_id', b.name);
      const already = new Map((done ?? []).map((r: any) => [r.object_path, r.version_key]));

      for (const o of objs) {
        if (already.get(o.path) === o.versionKey) continue;
        if (Date.now() - started > TIME_BUDGET_MS) { partial = true; break outer; }
        if (o.size > MAX_FILE_BYTES) {
          skippedLarge++; problems.push(`too large to copy (${Math.round(o.size / 1048576)} MB): ${b.name}/${o.path}`);
          continue;
        }
        try {
          const { data: blob, error: dErr } = await admin.storage.from(b.name).download(o.path);
          if (dErr || !blob) throw new Error(dErr?.message ?? 'download failed');
          const body = new Uint8Array(await blob.arrayBuffer());
          const key = [PROJECT_REF, b.name, ...o.path.split('/')].map(encodeURIComponent).join('/');
          const res = await aws.fetch(`https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`, { method: 'PUT', body });
          if (!res.ok) throw new Error(`S3 ${res.status}: ${(await res.text()).slice(0, 200)}`);
          await admin.from('backup_file_log').upsert({
            bucket_id: b.name, object_path: o.path, version_key: o.versionKey, size_bytes: body.byteLength, copied_at: new Date().toISOString(),
          });
          copied++; bytes += body.byteLength;
        } catch (e) {
          failed++; problems.push(`${b.name}/${o.path}: ${(e as Error).message}`);
        }
      }
    }

    const status = failed > 0 || skippedLarge > 0 ? 'failed' : partial ? 'partial' : 'ok';
    await admin.from('backup_runs').update({
      finished_at: new Date().toISOString(), status, files_scanned: scanned, files_copied: copied,
      files_failed: failed + skippedLarge, bytes_copied: bytes, note: problems.slice(0, 20).join('\n') || null,
    }).eq('id', runId);

    if (status === 'failed') {
      await alertAdmin(
        `MaraeHub file backup problem (${PROJECT_REF})`,
        `Tonight's file backup copied ${copied} file(s) but ${failed + skippedLarge} could not be copied.\n\n${problems.slice(0, 20).join('\n')}`,
      );
    }
    return json({ status, scanned, copied, failed, skippedLarge, bytes, partial });
  } catch (e) {
    const msg = (e as Error).message;
    await admin.from('backup_runs').update({ finished_at: new Date().toISOString(), status: 'error', files_scanned: scanned, files_copied: copied, files_failed: failed, note: msg }).eq('id', runId);
    await alertAdmin(`MaraeHub file backup failed (${PROJECT_REF})`, `The nightly file backup stopped with an error:\n\n${msg}`);
    return json({ error: msg }, 500);
  }
});
