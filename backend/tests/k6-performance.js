import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom failure metric
const failureRate = new Rate('failed_requests');

// Realistic workload configuration with targeted ramps
export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Warm-up & 100 RPS baseline
    { duration: '30s', target: 500 },   // Ramp to 500 RPS
    { duration: '45s', target: 1000 },  // 1,000 RPS production target
    { duration: '45s', target: 2500 },  // 2,500 RPS peak load
    { duration: '30s', target: 5000 },  // 5,000 RPS stress test
    { duration: '30s', target: 7500 },  // 7,500 RPS endurance test
    { duration: '30s', target: 10000 }, // 10,000 RPS ultimate saturation test
    { duration: '30s', target: 0 },     // Ramp-down & recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<800'], // 95% of requests under 300ms
    failed_requests: ['rate<0.02'],               // Error rate < 2%
  },
};

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:5000/api';

export default function () {
  // 1. Health check & status
  const resHealth = http.get(`${BASE_URL}/health`);
  const healthOk = check(resHealth, {
    'health status 200': (r) => r.status === 200,
  });
  failureRate.add(!healthOk);

  // 2. Fetch public hostels
  const resHostels = http.get(`${BASE_URL}/hostels`);
  const hostelsOk = check(resHostels, {
    'hostels status 200': (r) => r.status === 200,
  });
  failureRate.add(!hostelsOk);

  // 3. Fetch public mess menu
  const resMess = http.get(`${BASE_URL}/mess-menu/latest`);
  const messOk = check(resMess, {
    'mess menu status 200': (r) => r.status === 200,
  });
  failureRate.add(!messOk);

  // 4. Fetch bus routes
  const resBus = http.get(`${BASE_URL}/bus-routes`);
  const busOk = check(resBus, {
    'bus routes status 200': (r) => r.status === 200,
  });
  failureRate.add(!busOk);

  sleep(0.1);
}
