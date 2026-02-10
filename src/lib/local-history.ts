export type JobStatus = 'COMPLETED' | 'FAILED';
export type MessageStatus = 'SENT' | 'FAILED';

export interface LocalJob {
  id: string;
  source_filename: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  duplicate_rows: number;
  sent_ok: number;
  sent_failed: number;
  status: JobStatus;
  created_at: string;
}

export interface LocalMessage {
  id: string;
  job_id: string;
  phone_e164: string;
  guide_number: string;
  recipient_name: string;
  status: MessageStatus;
  error_message: string | null;
  wa_message_id: string | null;
  created_at: string;
}

const JOBS_KEY = 'wa-local-jobs';
const MESSAGES_KEY = 'wa-local-messages';

function readJson<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, value: T[]) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getJobs(): LocalJob[] {
  return readJson<LocalJob>(JOBS_KEY).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getMessages(): LocalMessage[] {
  return readJson<LocalMessage>(MESSAGES_KEY).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function getMessagesByJob(jobId: string): LocalMessage[] {
  return getMessages().filter(message => message.job_id === jobId);
}

export function getSentMessageKeySet(): Set<string> {
  const sentMessages = getMessages().filter(message => message.status === 'SENT');
  return new Set(sentMessages.map(message => `${message.phone_e164}|${message.guide_number}`));
}

export function saveJobWithMessages(job: LocalJob, messages: LocalMessage[]) {
  const currentJobs = readJson<LocalJob>(JOBS_KEY);
  const currentMessages = readJson<LocalMessage>(MESSAGES_KEY);
  currentJobs.push(job);
  currentMessages.push(...messages);
  writeJson(JOBS_KEY, currentJobs);
  writeJson(MESSAGES_KEY, currentMessages);
}
