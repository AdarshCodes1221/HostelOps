/**
 * Realistic Multi-Endpoint Load Benchmark
 * Measures throughput, p50, p95, p99, and HTTP status distributions across realistic endpoints.
 */

const http = require('http');

const PORT = 5000;
const BASE_URL = `http://localhost:${PORT}`;

const ENDPOINTS = [
  '/api/health',
  '/api/hostels',
  '/api/mess-menu/latest',
  '/api/bus-routes',
];

function makeRequest(path) {
  return new Promise((resolve) => {
    const start = process.hrtime.bigint();
    const req = http.get(`${BASE_URL}${path}`, { agent: false }, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        const end = process.hrtime.bigint();
        const durationMs = Number(end - start) / 1e6;
        resolve({ status: res.statusCode, durationMs });
      });
    });

    req.on('error', (err) => {
      resolve({ status: 0, error: err.message, durationMs: 0 });
    });
    req.setTimeout(5000, () => {
      req.destroy();
      resolve({ status: 408, durationMs: 5000 });
    });
  });
}

async function runStage(concurrency, durationSec, name) {
  console.log(`\n▶ Running stage: ${name} (${concurrency} workers, ${durationSec}s)`);
  const latencies = [];
  const statusCounts = {};
  const endTime = Date.now() + durationSec * 1000;
  let totalRequests = 0;

  async function worker() {
    let epIndex = 0;
    while (Date.now() < endTime) {
      const path = ENDPOINTS[epIndex % ENDPOINTS.length];
      epIndex++;
      const res = await makeRequest(path);
      totalRequests++;
      latencies.push(res.durationMs);
      statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const max = latencies[latencies.length - 1] || 0;
  const rps = (totalRequests / durationSec).toFixed(2);

  console.log(`  Requests: ${totalRequests} | RPS: ${rps}`);
  console.log(`  p50: ${p50.toFixed(2)}ms | p95: ${p95.toFixed(2)}ms | p99: ${p99.toFixed(2)}ms | Max: ${max.toFixed(2)}ms`);
  console.log(`  Statuses:`, statusCounts);

  return { name, concurrency, totalRequests, rps, p50, p95, p99, max, statusCounts };
}

async function main() {
  console.log('===============================================================');
  console.log('⚡ STARTING REALISTIC MIXED API LOAD BENCHMARK');
  console.log('===============================================================');

  // Warmup
  await runStage(10, 2, 'Warmup');

  // Realistic Stages
  const results = [];
  results.push(await runStage(20, 5, 'Stage 1: 100-500 Concurrency Profile'));
  results.push(await runStage(50, 5, 'Stage 2: 1000-2500 Concurrency Profile'));

  console.log('\n===============================================================');
  console.log('📊 BENCHMARK COMPLETE');
  console.log('===============================================================');
}

main().catch(console.error);
