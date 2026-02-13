#!/usr/bin/env node

/**
 * Stress test utility for WhatsApp Sender Pro.
 *
 * What it does:
 * 1) Creates a test job assigned to the JWT user
 * 2) Enqueues synthetic messages in chunks through enqueue-messages
 * 3) Processes queue in loops through process-message-queue
 * 4) Prints throughput and final stats
 *
 * Required env vars:
 * - SUPABASE_URL
 * - SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY
 * - STRESS_USER_JWT
 * - API_KEY
 *
 * Optional env vars:
 * - STRESS_TOTAL_MESSAGES (default: 1000)
 * - STRESS_ENQUEUE_CHUNK (default: 200)
 * - STRESS_PROCESS_MAX_MESSAGES (default: 20)
 * - STRESS_POLL_INTERVAL_MS (default: 500)
 * - STRESS_SOURCE_FILENAME (default: stress-test-<timestamp>.xlsx)
 */

import { createClient } from '@supabase/supabase-js';

const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRESS_USER_JWT',
  'API_KEY',
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRESS_USER_JWT = process.env.STRESS_USER_JWT;
const API_KEY = process.env.API_KEY;

const TOTAL_MESSAGES = Number(process.env.STRESS_TOTAL_MESSAGES || 1000);
const ENQUEUE_CHUNK = Number(process.env.STRESS_ENQUEUE_CHUNK || 200);
const PROCESS_MAX_MESSAGES = Number(process.env.STRESS_PROCESS_MAX_MESSAGES || 20);
const POLL_INTERVAL_MS = Number(process.env.STRESS_POLL_INTERVAL_MS || 500);
const SOURCE_FILENAME =
  process.env.STRESS_SOURCE_FILENAME || `stress-test-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Invalid JWT format');
  const payload = parts[1]
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const normalized = payload + '='.repeat((4 - (payload.length % 4)) % 4);
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
}

function buildRows(total) {
  const rows = [];
  for (let i = 0; i < total; i += 1) {
    const phone = `+573${String(100000000 + i).slice(0, 9)}`;
    const guide = `700${String(100000000 + i).padStart(9, '0')}`;
    rows.push({
      phone_e164: phone,
      guide_number: guide,
      recipient_name: `Stress User ${i + 1}`,
    });
  }
  return rows;
}

async function callFunction(path, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRESS_USER_JWT}`,
      apikey: SUPABASE_ANON_KEY,
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(json)}`);
  }
  return json;
}

async function getQueueStats(serviceClient, jobId) {
  const { data, error } = await serviceClient.rpc('get_job_queue_stats', { job_uuid: jobId });
  if (error) throw error;
  return data || { pending: 0, retrying: 0, sent: 0, failed: 0, processing: 0, total: 0 };
}

async function main() {
  console.log('🚀 Starting stress test...');
  console.log(`   TOTAL_MESSAGES=${TOTAL_MESSAGES}`);
  console.log(`   ENQUEUE_CHUNK=${ENQUEUE_CHUNK}`);
  console.log(`   PROCESS_MAX_MESSAGES=${PROCESS_MAX_MESSAGES}`);

  const payload = decodeJwtPayload(STRESS_USER_JWT);
  const userId = payload.sub;
  if (!userId) throw new Error('Could not extract user id (sub) from STRESS_USER_JWT');

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: job, error: jobError } = await serviceClient
    .from('jobs')
    .insert({
      source_filename: SOURCE_FILENAME,
      total_rows: TOTAL_MESSAGES,
      valid_rows: TOTAL_MESSAGES,
      invalid_rows: 0,
      duplicate_rows: 0,
      status: 'QUEUED',
      assigned_to: 'stress-test',
      user_id: userId,
    })
    .select('id')
    .single();

  if (jobError || !job) throw jobError || new Error('Failed to create job');

  const jobId = job.id;
  console.log(`🧪 Created test job: ${jobId}`);

  const rows = buildRows(TOTAL_MESSAGES);

  let enqueued = 0;
  for (let start = 0; start < rows.length; start += ENQUEUE_CHUNK) {
    const chunk = rows.slice(start, start + ENQUEUE_CHUNK);
    const res = await callFunction('enqueue-messages', {
      jobId,
      rows: chunk,
      autoProcess: false,
      senderName: 'Stress Test Sender',
    });
    enqueued += Number(res.enqueued || chunk.length);
    console.log(`📥 Enqueued ${enqueued}/${TOTAL_MESSAGES}`);
  }

  const startedAt = Date.now();
  let loop = 0;
  let totalProcessed = 0;
  let totalSent = 0;
  let totalFailed = 0;
  let totalRetrying = 0;

  while (true) {
    loop += 1;
    const processRes = await callFunction('process-message-queue', {
      jobId,
      maxMessages: PROCESS_MAX_MESSAGES,
    });

    totalProcessed += Number(processRes.processed || 0);
    totalSent += Number(processRes.sent || 0);
    totalFailed += Number(processRes.failed || 0);
    totalRetrying += Number(processRes.retrying || 0);

    const stats = await getQueueStats(serviceClient, jobId);
    const remaining = Number(stats.pending || 0) + Number(stats.retrying || 0);

    const elapsedSec = (Date.now() - startedAt) / 1000;
    const throughput = elapsedSec > 0 ? (Number(stats.sent || 0) / elapsedSec) : 0;

    console.log(
      `⚙️  loop=${loop} processed=${processRes.processed || 0} remaining=${remaining} sent=${stats.sent || 0} failed=${stats.failed || 0} throughput=${throughput.toFixed(2)} msg/s`
    );

    if (remaining === 0) {
      const totalSec = (Date.now() - startedAt) / 1000;
      console.log('\n✅ Stress test completed');
      console.log(`   Job ID: ${jobId}`);
      console.log(`   Duration: ${totalSec.toFixed(2)}s`);
      console.log(`   Enqueued: ${enqueued}`);
      console.log(`   Processed(acc): ${totalProcessed}`);
      console.log(`   Sent(acc): ${totalSent}`);
      console.log(`   Failed(acc): ${totalFailed}`);
      console.log(`   Retrying(acc): ${totalRetrying}`);
      console.log(`   Final sent: ${stats.sent || 0}`);
      console.log(`   Final failed: ${stats.failed || 0}`);
      console.log(`   Avg throughput: ${(Number(stats.sent || 0) / Math.max(totalSec, 1)).toFixed(2)} msg/s`);
      break;
    }

    await sleep(POLL_INTERVAL_MS);
  }
}

main().catch((err) => {
  console.error('❌ Stress test failed:', err.message);
  process.exit(1);
});
