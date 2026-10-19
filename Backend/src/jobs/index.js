/**
 * Background jobs entry point (blueprint: jobs/index.js).
 *   workers/    long-running consumers (none yet — reconciliation runs execute in-process via setImmediate)
 *   schedules/  cron-style schedules (the Jurinex Voice call scheduler lives inside its module)
 * `startJobs()` is called from src/server.js once the HTTP port is open; register new jobs here.
 */
const jobs = [];

function register(job) {
  if (!job || typeof job.start !== 'function') throw new Error('A job must expose start()');
  jobs.push(job);
}

async function startJobs(context = {}) {
  for (const job of jobs) await job.start(context);
  return jobs.length;
}

async function stopJobs() {
  for (const job of jobs) if (typeof job.stop === 'function') await job.stop();
}

module.exports = { register, startJobs, stopJobs, list: () => jobs.map((j) => j.name || 'anonymous') };
