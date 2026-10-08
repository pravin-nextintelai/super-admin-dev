#!/usr/bin/env node
/**
 * Admin Dashboard API — Automated Test Runner & Report Generator
 *
 * Usage:
 *   ADMIN_TOKEN=... npm run test:admin-api
 *   ADMIN_TOKEN=... BASE_URL=http://localhost:4000 node tests/run_admin_api_tests.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ── Config ──────────────────────────────────────────────────────────────────
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const MAX_SAMPLE_BYTES = 2048;

if (!ADMIN_TOKEN) {
    console.error('❌  ADMIN_TOKEN environment variable is required.');
    console.error('   Usage: ADMIN_TOKEN=<token> npm run test:admin-api');
    process.exit(1);
}

const authHeaders = { Authorization: `Bearer ${ADMIN_TOKEN}` };

// ── Helpers ─────────────────────────────────────────────────────────────────

function truncate(obj) {
    const s = JSON.stringify(obj, null, 2);
    return s.length > MAX_SAMPLE_BYTES ? s.slice(0, MAX_SAMPLE_BYTES) + '\n... (truncated)' : s;
}

function dur(ms) { return `${ms}ms`; }

async function request(method, urlPath, { headers = {}, params = {}, data = null, label = '' } = {}) {
    const url = `${BASE_URL}${urlPath}`;
    const start = Date.now();
    try {
        const res = await axios({ method, url, headers: { ...authHeaders, ...headers }, params, data, timeout: 15000, validateStatus: () => true });
        const latency = Date.now() - start;
        return { status: res.status, data: res.data, latency, error: null };
    } catch (err) {
        const latency = Date.now() - start;
        if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
            return { status: 0, data: null, latency, error: `Connection failed: ${err.code}` };
        }
        return { status: 0, data: null, latency, error: err.message };
    }
}

// ── Test definitions ────────────────────────────────────────────────────────

const results = []; // { name, group, method, path, purpose, inputs, curl, expected, actual, pass, latency, sample, errorDetail }

function addResult(r) {
    const pf = r.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${pf}  ${r.method} ${r.path}  → ${r.actual} (${dur(r.latency)})`);
    results.push(r);
}

function buildCurl(method, urlPath, headers = {}, body = null, params = {}) {
    let curl = `curl -s -X ${method}`;
    curl += ` -H "Authorization: Bearer <ADMIN_TOKEN>"`;
    for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === 'authorization') continue;
        curl += ` -H "${k}: ${v}"`;
    }
    const qs = new URLSearchParams(params).toString();
    const fullUrl = `${BASE_URL}${urlPath}${qs ? '?' + qs : ''}`;
    curl += ` "${fullUrl}"`;
    if (body) {
        curl += ` -H "Content-Type: application/json"`;
        curl += ` -d '${JSON.stringify(body)}'`;
    }
    return curl;
}

// ── Test runner ─────────────────────────────────────────────────────────────

async function runTests() {
    console.log('\n' + '═'.repeat(70));
    console.log('  Admin Dashboard API — Automated Tests');
    console.log('  ' + new Date().toISOString());
    console.log('  Base URL: ' + BASE_URL);
    console.log('═'.repeat(70) + '\n');

    // ── Pre-flight: server reachable? ──
    console.log('⏳ Checking server connectivity...');
    const ping = await request('GET', '/api/admin/health');
    if (ping.status === 0) {
        console.error(`\n❌  Server unreachable at ${BASE_URL}`);
        console.error(`   ${ping.error}`);
        console.error('   Make sure the backend is running: npm start\n');
        process.exit(1);
    }
    console.log(`✅ Server reachable (health: ${ping.status})\n`);

    // ════════════════════════════════════════════════════════════════════════
    // A) Overview
    // ════════════════════════════════════════════════════════════════════════
    console.log('── A) Overview ──');
    {
        const r = await request('GET', '/api/admin/overview');
        addResult({
            name: 'Overview', group: 'Overview', method: 'GET', path: '/api/admin/overview',
            purpose: 'Dashboard summary: total judgments, verified/unverified counts, confidence distribution, HITL pending, blacklist count, ingestion status, today citations.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/overview'),
            expected: '200 + { success: true, data: { total_judgments, ... } }',
            actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // B) HITL Queue
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── B) HITL Queue ──');
    let hitlTaskId = null;
    {
        const params = { status: 'PENDING', page: 1, pageSize: 5, sort: 'priority_desc' };
        const r = await request('GET', '/api/admin/hitl', { params });
        const pass = r.status === 200 && r.data?.success === true && Array.isArray(r.data?.data?.tasks);
        addResult({
            name: 'HITL List', group: 'HITL Queue', method: 'GET', path: '/api/admin/hitl',
            purpose: 'List HITL pending tasks with pagination, sortable by priority.',
            inputs: 'Query: status, page, pageSize, sort', curl: buildCurl('GET', '/api/admin/hitl', {}, null, params),
            expected: '200 + data.tasks array', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
        if (pass && r.data.data.tasks.length > 0) {
            hitlTaskId = r.data.data.tasks[0].task_id;
        }
    }

    // HITL detail
    {
        const id = hitlTaskId || '00000000-0000-0000-0000-000000000000';
        const expectedStatus = hitlTaskId ? 200 : 404;
        const r = await request('GET', `/api/admin/hitl/${id}`);
        addResult({
            name: 'HITL Detail', group: 'HITL Queue', method: 'GET', path: `/api/admin/hitl/${id}`,
            purpose: 'Get single HITL task detail by ID.',
            inputs: 'Params: taskId', curl: buildCurl('GET', `/api/admin/hitl/${id}`),
            expected: `${expectedStatus}`, actual: r.status, pass: r.status === expectedStatus,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // HITL action — valid
    if (hitlTaskId) {
        const body = { action: 'APPROVED', reviewer: 'admin-test', notes: 'automated test', blacklist: false, reason: '' };
        const r = await request('POST', `/api/admin/hitl/${hitlTaskId}/action`, { data: body });
        addResult({
            name: 'HITL Action (APPROVED)', group: 'HITL Queue', method: 'POST', path: `/api/admin/hitl/${hitlTaskId}/action`,
            purpose: 'Process HITL task action (APPROVED/REJECTED/ESCALATED).',
            inputs: 'Body: { action, reviewer, notes, blacklist, reason }', curl: buildCurl('POST', `/api/admin/hitl/${hitlTaskId}/action`, {}, body),
            expected: '200', actual: r.status, pass: r.status === 200,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // HITL action — invalid (validation test)
    {
        const id = hitlTaskId || '1';
        const body = { action: 'INVALID' };
        const r = await request('POST', `/api/admin/hitl/${id}/action`, { data: body });
        addResult({
            name: 'HITL Action (INVALID — expect 400)', group: 'HITL Queue', method: 'POST', path: `/api/admin/hitl/${id}/action`,
            purpose: 'Validate action body — invalid action should return 400.',
            inputs: 'Body: { action: "INVALID" }', curl: buildCurl('POST', `/api/admin/hitl/${id}/action`, {}, body),
            expected: '400', actual: r.status, pass: r.status === 400,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // C) Data Pipeline
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── C) Data Pipeline ──');
    {
        const r = await request('GET', '/api/admin/pipeline/summary');
        addResult({
            name: 'Pipeline Summary', group: 'Data Pipeline', method: 'GET', path: '/api/admin/pipeline/summary',
            purpose: 'Ingestion queue status counts grouped by status.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/pipeline/summary'),
            expected: '200 + object', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { status: 'FAILED', hasError: 'true', page: 1, pageSize: 5 };
        const r = await request('GET', '/api/admin/pipeline/items', { params });
        addResult({
            name: 'Pipeline Items', group: 'Data Pipeline', method: 'GET', path: '/api/admin/pipeline/items',
            purpose: 'List ingestion queue items with filters: status, source, date range, hasError.',
            inputs: 'Query: status, hasError, page, pageSize', curl: buildCurl('GET', '/api/admin/pipeline/items', {}, null, params),
            expected: '200 + paginated list', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { limit: 5 };
        const r = await request('GET', '/api/admin/pipeline/errors', { params });
        addResult({
            name: 'Pipeline Errors', group: 'Data Pipeline', method: 'GET', path: '/api/admin/pipeline/errors',
            purpose: 'Recent ingestion errors.',
            inputs: 'Query: limit', curl: buildCurl('GET', '/api/admin/pipeline/errors', {}, null, params),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // D) Routes & DB
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── D) Routes & DB ──');
    {
        const r = await request('GET', '/api/admin/routesdb/summary');
        addResult({
            name: 'RoutesDB Summary', group: 'Routes & DB', method: 'GET', path: '/api/admin/routesdb/summary',
            purpose: 'Total judgments, aliases, statutes, verification breakdown.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/routesdb/summary'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { limit: 5 };
        const r = await request('GET', '/api/admin/routesdb/top-cited', { params });
        addResult({
            name: 'RoutesDB Top Cited', group: 'Routes & DB', method: 'GET', path: '/api/admin/routesdb/top-cited',
            purpose: 'Top judgments by citation_frequency.',
            inputs: 'Query: limit', curl: buildCurl('GET', '/api/admin/routesdb/top-cited', {}, null, params),
            expected: '200 + array', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const r = await request('GET', '/api/admin/routesdb/courts-breakdown');
        addResult({
            name: 'RoutesDB Courts Breakdown', group: 'Routes & DB', method: 'GET', path: '/api/admin/routesdb/courts-breakdown',
            purpose: 'Court distribution grouped by court_tier and court_code.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/routesdb/courts-breakdown'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // E) Business Metrics
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── E) Business Metrics ──');
    {
        const r = await request('GET', '/api/admin/business/summary');
        addResult({
            name: 'Business Summary', group: 'Business Metrics', method: 'GET', path: '/api/admin/business/summary',
            purpose: 'Total reports count and average citations per report.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/business/summary'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { days: 7 };
        const r = await request('GET', '/api/admin/business/reports-per-day', { params });
        addResult({
            name: 'Business Reports/Day', group: 'Business Metrics', method: 'GET', path: '/api/admin/business/reports-per-day',
            purpose: 'Reports count per day for the last N days.',
            inputs: 'Query: days', curl: buildCurl('GET', '/api/admin/business/reports-per-day', {}, null, params),
            expected: '200 + array', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { limit: 5 };
        const r = await request('GET', '/api/admin/business/top-users', { params });
        const pass = r.status === 200 && r.data?.success === true;
        let note = '';
        if (pass && Array.isArray(r.data?.data)) {
            const hasEmail = r.data.data.some(u => u.email);
            if (!hasEmail) note = 'Note: email/username not enriched (Auth DB join may have no matching users).';
        }
        addResult({
            name: 'Business Top Users', group: 'Business Metrics', method: 'GET', path: '/api/admin/business/top-users',
            purpose: 'Top users by report count, enriched with email/username from Auth DB.',
            inputs: 'Query: limit', curl: buildCurl('GET', '/api/admin/business/top-users', {}, null, params),
            expected: '200 + array', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error || note || null,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // F) User Management
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── F) User Management ──');
    let testUserId = null;
    {
        const params = { page: 1, pageSize: 5 };
        const r = await request('GET', '/api/admin/users', { params });
        const pass = r.status === 200 && r.data?.success === true && Array.isArray(r.data?.data?.users);
        addResult({
            name: 'Users List', group: 'User Management', method: 'GET', path: '/api/admin/users',
            purpose: 'List users with pagination, filterable by role, approval_status, account_type, search.',
            inputs: 'Query: page, pageSize, role, approval_status, account_type, search',
            curl: buildCurl('GET', '/api/admin/users', {}, null, params),
            expected: '200 + data.users array', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
        if (pass && r.data.data.users.length > 0) {
            testUserId = r.data.data.users[0].id;
        }
    }
    {
        const r = await request('GET', '/api/admin/users/pending');
        addResult({
            name: 'Users Pending', group: 'User Management', method: 'GET', path: '/api/admin/users/pending',
            purpose: 'List users with approval_status=PENDING.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/users/pending'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
        // Prefer pending user for mutation tests
        if (r.data?.success && r.data.data?.users?.length > 0) {
            testUserId = r.data.data.users[0].id;
        }
    }
    {
        const r = await request('GET', '/api/admin/users/stats');
        addResult({
            name: 'Users Stats', group: 'User Management', method: 'GET', path: '/api/admin/users/stats',
            purpose: 'User statistics: total, active, blocked, pending, by account type.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/users/stats'),
            expected: '200', actual: r.status, pass: r.status === 200 && r.data?.success === true,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    if (testUserId) {
        // Approve
        {
            const r = await request('POST', `/api/admin/users/${testUserId}/approve`);
            addResult({
                name: 'User Approve', group: 'User Management', method: 'POST', path: `/api/admin/users/${testUserId}/approve`,
                purpose: 'Approve a user: sets approval_status=APPROVED, is_active=true.',
                inputs: 'Params: id', curl: buildCurl('POST', `/api/admin/users/${testUserId}/approve`),
                expected: '200', actual: r.status, pass: r.status === 200,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        // Block
        {
            const r = await request('POST', `/api/admin/users/${testUserId}/block`);
            addResult({
                name: 'User Block', group: 'User Management', method: 'POST', path: `/api/admin/users/${testUserId}/block`,
                purpose: 'Block a user: sets is_blocked=true, is_active=false.',
                inputs: 'Params: id', curl: buildCurl('POST', `/api/admin/users/${testUserId}/block`),
                expected: '200', actual: r.status, pass: r.status === 200,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        // Unblock
        {
            const r = await request('POST', `/api/admin/users/${testUserId}/unblock`);
            addResult({
                name: 'User Unblock', group: 'User Management', method: 'POST', path: `/api/admin/users/${testUserId}/unblock`,
                purpose: 'Unblock a user: sets is_blocked=false, is_active=true.',
                inputs: 'Params: id', curl: buildCurl('POST', `/api/admin/users/${testUserId}/unblock`),
                expected: '200', actual: r.status, pass: r.status === 200,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
    } else {
        console.log('  ⚠️  No user ID available — skipping approve/block/unblock tests');
    }

    // ════════════════════════════════════════════════════════════════════════
    // H) Contact Enquiries (Marketing) — website form → IST timeline
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── H) Contact Enquiries (Marketing) ──');
    let enquiryId = null;
    {
        // Public intake: no Authorization header (the website calls this).
        const stamp = Date.now();
        const body = {
            name: 'API', surname: 'Test', email: `api.test+${stamp}@example.com`, mobile: '+91 90000 00000',
            organisationName: 'Automated Test', whatIsThisAbout: 'Pricing & plans',
            additionalDetails: `automated test ${stamp}`, consent: true, pageUrl: 'https://jurinex.ai/contact',
        };
        const url = `${BASE_URL}/api/public/contact`;
        const start = Date.now();
        let res;
        try {
            res = await axios.post(url, body, { headers: { Origin: 'https://jurinex.ai' }, timeout: 15000, validateStatus: () => true });
        } catch (e) {
            res = { status: 0, data: null };
        }
        const latency = Date.now() - start;
        const pass = res.status === 201 && res.data?.data?.reference_no && res.data?.data?.submitted_at_ist?.display;
        addResult({
            name: 'Public Contact Submit', group: 'Contact Enquiries', method: 'POST', path: '/api/public/contact',
            purpose: 'Website "Contact Jurinex" form intake (no auth). Returns reference number + IST submission time.',
            inputs: 'Body: { name, surname, email, mobile, organisationName, whatIsThisAbout, additionalDetails, consent, pageUrl }',
            curl: `curl -s -X POST -H "Content-Type: application/json" -d '${JSON.stringify(body)}' "${url}"`,
            expected: '201 + data.reference_no + data.submitted_at_ist', actual: res.status, pass,
            latency, sample: truncate(res.data), errorDetail: null,
        });
        if (pass) enquiryId = res.data.data.id;
    }
    {
        const r = await request('GET', '/api/admin/contact-enquiries/stats');
        addResult({
            name: 'Contact Enquiry Stats', group: 'Contact Enquiries', method: 'GET', path: '/api/admin/contact-enquiries/stats',
            purpose: 'KPI totals (today / 7d / month in IST), response time, by-status, by-topic, 14-day trend.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/contact-enquiries/stats'),
            expected: '200 + data.totals', actual: r.status, pass: r.status === 200 && r.data?.data?.totals !== undefined,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const r = await request('GET', '/api/admin/contact-enquiries/meta');
        addResult({
            name: 'Contact Enquiry Meta', group: 'Contact Enquiries', method: 'GET', path: '/api/admin/contact-enquiries/meta',
            purpose: 'Dropdown values (statuses, channels, topics) and assignable admins.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/contact-enquiries/meta'),
            expected: '200 + data.statuses', actual: r.status, pass: r.status === 200 && Array.isArray(r.data?.data?.statuses),
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { status: 'open', sort: 'awaiting_longest', page: 1, limit: 5 };
        const r = await request('GET', '/api/admin/contact-enquiries', { params });
        addResult({
            name: 'Contact Enquiry List', group: 'Contact Enquiries', method: 'GET', path: '/api/admin/contact-enquiries',
            purpose: 'Paginated list with filters; every row carries submitted_at_ist.',
            inputs: 'Query: status, topic, priority, consent, assigned, search, from, to, sort, page, limit',
            curl: buildCurl('GET', '/api/admin/contact-enquiries', {}, null, params),
            expected: '200 + data.enquiries[]', actual: r.status, pass: r.status === 200 && Array.isArray(r.data?.data?.enquiries),
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    if (enquiryId) {
        {
            const r = await request('GET', `/api/admin/contact-enquiries/${enquiryId}`);
            addResult({
                name: 'Contact Enquiry Detail', group: 'Contact Enquiries', method: 'GET', path: `/api/admin/contact-enquiries/${enquiryId}`,
                purpose: 'Single enquiry + activity timeline.',
                inputs: 'Params: id', curl: buildCurl('GET', `/api/admin/contact-enquiries/${enquiryId}`),
                expected: '200 + data.enquiry + data.activities', actual: r.status,
                pass: r.status === 200 && r.data?.data?.enquiry && Array.isArray(r.data?.data?.activities),
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        {
            const body = { channel: 'call', outcome: 'connected', note: 'automated test call' };
            const r = await request('POST', `/api/admin/contact-enquiries/${enquiryId}/contact-log`, { data: body });
            addResult({
                name: 'Contact Enquiry Contact Log', group: 'Contact Enquiries', method: 'POST', path: `/api/admin/contact-enquiries/${enquiryId}/contact-log`,
                purpose: 'Record that the team contacted the lead; stamps first/last contacted time in IST and moves new → contacted.',
                inputs: 'Body: { channel, outcome, note, contacted_at?, set_status? }',
                curl: buildCurl('POST', `/api/admin/contact-enquiries/${enquiryId}/contact-log`, {}, body),
                expected: '200 + enquiry.first_contacted_at_ist', actual: r.status,
                pass: r.status === 200 && r.data?.data?.enquiry?.status === 'contacted' && r.data?.data?.enquiry?.first_contacted_at_ist?.display,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        {
            const body = { status: 'closed', priority: 'low', note: 'automated test close' };
            const r = await request('PATCH', `/api/admin/contact-enquiries/${enquiryId}`, { data: body });
            addResult({
                name: 'Contact Enquiry Update', group: 'Contact Enquiries', method: 'PATCH', path: `/api/admin/contact-enquiries/${enquiryId}`,
                purpose: 'Change status / priority / assignee with timeline entries.',
                inputs: 'Body: { status?, priority?, assigned_to?, note? }',
                curl: buildCurl('PATCH', `/api/admin/contact-enquiries/${enquiryId}`, {}, body),
                expected: '200 + enquiry.status = closed', actual: r.status,
                pass: r.status === 200 && r.data?.data?.enquiry?.status === 'closed',
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        {
            const params = { search: 'api.test+' };
            const r = await request('GET', '/api/admin/contact-enquiries/export', { params });
            const isCsv = typeof r.data === 'string' && r.data.includes('Submitted (IST)');
            addResult({
                name: 'Contact Enquiry CSV Export', group: 'Contact Enquiries', method: 'GET', path: '/api/admin/contact-enquiries/export',
                purpose: 'CSV export with IST columns; same filters as the list.',
                inputs: 'Query: same as list', curl: buildCurl('GET', '/api/admin/contact-enquiries/export', {}, null, params),
                expected: '200 text/csv', actual: r.status, pass: r.status === 200 && isCsv,
                latency: r.latency, sample: typeof r.data === 'string' ? r.data.slice(0, 600) : truncate(r.data), errorDetail: r.error,
            });
        }
        {
            const r = await request('DELETE', `/api/admin/contact-enquiries/${enquiryId}`);
            addResult({
                name: 'Contact Enquiry Delete (cleanup)', group: 'Contact Enquiries', method: 'DELETE', path: `/api/admin/contact-enquiries/${enquiryId}`,
                purpose: 'Remove the test enquiry (super-admin / static token only).',
                inputs: 'Params: id', curl: buildCurl('DELETE', `/api/admin/contact-enquiries/${enquiryId}`),
                expected: '200', actual: r.status, pass: r.status === 200,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
    } else {
        console.log('  ⚠️  Public submit failed — skipping detail / contact-log / update / export / delete tests');
    }

    // ════════════════════════════════════════════════════════════════════════
    // I) Error Logs (Platform) — /api/admin/error-logs
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── I) Error Logs (Platform) ──');
    let errorLogId = null;
    let errorLogFingerprint = null;
    let errorLogService = null;
    let errorLogWasResolved = null;
    {
        const r = await request('GET', '/api/admin/error-logs/stats');
        const d = r.data?.data;
        const pass = r.status === 200 && r.data?.success === true
            && typeof d?.totals?.total === 'number' && typeof d?.totals?.unresolved === 'number'
            && typeof d?.totals?.affected_users === 'number'
            && Array.isArray(d?.daily_trend) && Array.isArray(d?.by_service) && Array.isArray(d?.top_issues)
            && Array.isArray(d?.top_users) && Array.isArray(d?.recent_unresolved) && Boolean(d?.generated_at_ist?.display);
        addResult({
            name: 'Error Logs Stats', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs/stats',
            purpose: 'KPIs (total / unresolved / last 24h / affected users), 14-day trend, breakdowns by service, category, source, severity, status code, top issues, top endpoints, top users.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/error-logs/stats'),
            expected: '200 + data.totals, daily_trend[], by_service[], top_issues[], top_users[]',
            actual: r.status, pass, latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const r = await request('GET', '/api/admin/error-logs/meta');
        const d = r.data?.data;
        const pass = r.status === 200 && r.data?.success === true
            && Array.isArray(d?.vocab?.sources) && Array.isArray(d?.vocab?.categories) && Array.isArray(d?.vocab?.severities)
            && Array.isArray(d?.used?.services) && Array.isArray(d?.sort_options) && typeof d?.permissions?.can_delete === 'boolean';
        addResult({
            name: 'Error Logs Meta', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs/meta',
            purpose: 'Filter vocabulary (sources, categories, severities) + distinct values actually present (services, environments, error types, providers, status codes) + permissions.',
            inputs: 'Headers: Authorization', curl: buildCurl('GET', '/api/admin/error-logs/meta'),
            expected: '200 + data.vocab, data.used.services[], data.permissions',
            actual: r.status, pass, latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { page: 1, limit: 5, resolved: 'all', sort: 'newest' };
        const r = await request('GET', '/api/admin/error-logs', { params });
        const d = r.data?.data;
        const first = d?.logs?.[0];
        const pass = r.status === 200 && r.data?.success === true && Array.isArray(d?.logs)
            && typeof d?.pagination?.total === 'number' && d?.filters?.timezone === 'Asia/Kolkata'
            && (!first || Boolean(first.id && first.created_at_ist?.display && typeof first.is_resolved === 'boolean' && first.service_name));
        addResult({
            name: 'Error Logs List', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs',
            purpose: 'Paginated list of captured errors with IST timestamps, user enrichment and occurrence counts.',
            inputs: 'Query: page, limit, resolved, sort (+ service, source, category, severity, status_code, user, search, from, to ...)',
            curl: buildCurl('GET', '/api/admin/error-logs', {}, null, params),
            expected: '200 + data.logs[], data.pagination', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
        if (pass && first) {
            errorLogId = first.id;
            errorLogFingerprint = first.fingerprint || null;
            errorLogService = first.service_name || null;
            errorLogWasResolved = first.is_resolved;
        }
    }
    if (errorLogService) {
        const params = { service: errorLogService, limit: 50 };
        const r = await request('GET', '/api/admin/error-logs', { params });
        const logs = r.data?.data?.logs || [];
        const pass = r.status === 200 && logs.length > 0 && logs.every(l => l.service_name === errorLogService);
        addResult({
            name: 'Error Logs List (service filter)', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs',
            purpose: 'Filter by service_name; every returned row must belong to that service.',
            inputs: `Query: service=${errorLogService}`, curl: buildCurl('GET', '/api/admin/error-logs', {}, null, params),
            expected: '200 + only rows for that service', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { resolved: 'false', limit: 50 };
        const r = await request('GET', '/api/admin/error-logs', { params });
        const logs = r.data?.data?.logs || [];
        const pass = r.status === 200 && logs.every(l => l.is_resolved === false) && r.data?.data?.filters?.resolved === false;
        addResult({
            name: 'Error Logs List (unresolved only)', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs',
            purpose: 'resolved=false returns only open errors.',
            inputs: 'Query: resolved=false', curl: buildCurl('GET', '/api/admin/error-logs', {}, null, params),
            expected: '200 + every row is_resolved=false', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { search: 'zzz-no-such-error-zzz' };
        const r = await request('GET', '/api/admin/error-logs', { params });
        const pass = r.status === 200 && Array.isArray(r.data?.data?.logs) && r.data.data.logs.length === 0 && r.data?.data?.pagination?.total === 0;
        addResult({
            name: 'Error Logs List (search, no match)', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs',
            purpose: 'Free-text search across message, endpoint, user, request id; a nonsense term returns an empty page, not an error.',
            inputs: 'Query: search', curl: buildCurl('GET', '/api/admin/error-logs', {}, null, params),
            expected: '200 + logs=[] total=0', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { status_code: 'abc' };
        const r = await request('GET', '/api/admin/error-logs', { params });
        addResult({
            name: 'Error Logs List (INVALID status_code — expect 400)', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs',
            purpose: 'status_code must be a comma-separated list of 100–599 integers.',
            inputs: 'Query: status_code=abc', curl: buildCurl('GET', '/api/admin/error-logs', {}, null, params),
            expected: '400 VALIDATION_ERROR', actual: r.status, pass: r.status === 400 && r.data?.error?.code === 'VALIDATION_ERROR',
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { from: '2026-02-01', to: '2026-01-01' };
        const r = await request('GET', '/api/admin/error-logs', { params });
        addResult({
            name: 'Error Logs List (INVALID date range — expect 400)', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs',
            purpose: '"from" must be on or before "to".',
            inputs: 'Query: from > to', curl: buildCurl('GET', '/api/admin/error-logs', {}, null, params),
            expected: '400 VALIDATION_ERROR', actual: r.status, pass: r.status === 400 && r.data?.error?.code === 'VALIDATION_ERROR',
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { page: 1, limit: 10, sort: 'most_errors' };
        const r = await request('GET', '/api/admin/error-logs/users', { params });
        const d = r.data?.data;
        const first = d?.users?.[0];
        const pass = r.status === 200 && Array.isArray(d?.users) && typeof d?.pagination?.total === 'number'
            && (!first || Boolean(first.user_key && typeof first.total === 'number' && typeof first.unresolved === 'number' && first.last_error_at_ist?.display));
        addResult({
            name: 'Error Logs Per User', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs/users',
            purpose: 'Errors grouped per platform user (user_id, else email): totals, unresolved, critical, last 24h, services, last error, enriched with Auth-DB user details.',
            inputs: 'Query: page, limit, sort (most_errors | recent | unresolved | critical), service, severity, resolved, search, from, to',
            curl: buildCurl('GET', '/api/admin/error-logs/users', {}, null, params),
            expected: '200 + data.users[], data.pagination', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { limit: 10 };
        const r = await request('GET', '/api/admin/error-logs/issues', { params });
        const d = r.data?.data;
        const first = d?.issues?.[0];
        const pass = r.status === 200 && Array.isArray(d?.issues)
            && (!first || Boolean(first.fingerprint && typeof first.count === 'number' && first.last_seen_ist?.display));
        addResult({
            name: 'Error Logs Issues (by fingerprint)', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs/issues',
            purpose: 'Distinct issues: rows grouped by fingerprint with count, unresolved, affected users, first/last seen.',
            inputs: 'Query: limit, service, severity, category, resolved, user, search, from, to',
            curl: buildCurl('GET', '/api/admin/error-logs/issues', {}, null, params),
            expected: '200 + data.issues[]', actual: r.status, pass,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const params = { resolved: 'all' };
        const r = await request('GET', '/api/admin/error-logs/export', { params });
        const body = typeof r.data === 'string' ? r.data : '';
        const pass = r.status === 200 && body.includes('Occurred (IST)') && body.includes('Error message');
        addResult({
            name: 'Error Logs CSV Export', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs/export',
            purpose: 'CSV download (UTF-8 BOM, IST columns) honouring the same filters as the list. Max 5000 rows.',
            inputs: 'Query: same as list', curl: buildCurl('GET', '/api/admin/error-logs/export', {}, null, params),
            expected: '200 text/csv with header row', actual: r.status, pass,
            latency: r.latency, sample: body.slice(0, 600), errorDetail: r.error,
        });
    }
    {
        const r = await request('GET', '/api/admin/error-logs/not-a-uuid');
        addResult({
            name: 'Error Log Detail (INVALID id — expect 400)', group: 'Error Logs', method: 'GET', path: '/api/admin/error-logs/not-a-uuid',
            purpose: 'Row ids are UUIDs; anything else is rejected before touching the DB.',
            inputs: 'Path: id', curl: buildCurl('GET', '/api/admin/error-logs/not-a-uuid'),
            expected: '400 VALIDATION_ERROR', actual: r.status, pass: r.status === 400,
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const id = '00000000-0000-4000-8000-000000000000';
        const r = await request('GET', `/api/admin/error-logs/${id}`);
        addResult({
            name: 'Error Log Detail (UNKNOWN id — expect 404)', group: 'Error Logs', method: 'GET', path: `/api/admin/error-logs/${id}`,
            purpose: 'Unknown UUID returns NOT_FOUND.',
            inputs: 'Path: id', curl: buildCurl('GET', `/api/admin/error-logs/${id}`),
            expected: '404 NOT_FOUND', actual: r.status, pass: r.status === 404 && r.data?.error?.code === 'NOT_FOUND',
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    if (errorLogId) {
        {
            const r = await request('GET', `/api/admin/error-logs/${errorLogId}`);
            const d = r.data?.data;
            const pass = r.status === 200 && d?.log?.id === errorLogId
                && Object.prototype.hasOwnProperty.call(d.log, 'stack_trace')
                && Object.prototype.hasOwnProperty.call(d.log, 'payload')
                && Array.isArray(d?.related?.same_request) && Array.isArray(d?.related?.same_issue)
                && Boolean(d?.log?.created_at_ist?.display);
            addResult({
                name: 'Error Log Detail', group: 'Error Logs', method: 'GET', path: `/api/admin/error-logs/${errorLogId}`,
                purpose: 'Full row incl. stack trace, payload, external API response, issue summary (occurrences) and related rows (same request id / same fingerprint).',
                inputs: 'Path: id (UUID)', curl: buildCurl('GET', `/api/admin/error-logs/${errorLogId}`),
                expected: '200 + data.log (with stack_trace, payload), data.issue, data.related', actual: r.status, pass,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        {
            const body = { resolved: true, note: 'automated test: resolved' };
            const r = await request('PATCH', `/api/admin/error-logs/${errorLogId}/resolve`, { data: body });
            const log = r.data?.data?.log;
            const pass = r.status === 200 && log?.is_resolved === true && Boolean(log?.resolved_by) && Boolean(log?.resolved_at_ist?.display) && log?.resolution_note === body.note;
            addResult({
                name: 'Error Log Resolve', group: 'Error Logs', method: 'PATCH', path: `/api/admin/error-logs/${errorLogId}/resolve`,
                purpose: 'Mark a single error resolved with a note; records resolved_by (admin email / admin-token) and resolved_at.',
                inputs: 'Body: { resolved: true, note }', curl: buildCurl('PATCH', `/api/admin/error-logs/${errorLogId}/resolve`, {}, body),
                expected: '200 + data.log.is_resolved=true', actual: r.status, pass,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        {
            const body = { resolved: false };
            const r = await request('PATCH', `/api/admin/error-logs/${errorLogId}/resolve`, { data: body });
            const log = r.data?.data?.log;
            const pass = r.status === 200 && log?.is_resolved === false && log?.resolved_by === null && log?.resolved_at === null;
            addResult({
                name: 'Error Log Reopen', group: 'Error Logs', method: 'PATCH', path: `/api/admin/error-logs/${errorLogId}/resolve`,
                purpose: 'resolved=false reopens the error and clears resolved_by / resolved_at / resolution_note.',
                inputs: 'Body: { resolved: false }', curl: buildCurl('PATCH', `/api/admin/error-logs/${errorLogId}/resolve`, {}, body),
                expected: '200 + data.log.is_resolved=false', actual: r.status, pass,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        {
            const body = { ids: [errorLogId], resolved: true, note: 'automated test: bulk' };
            const r = await request('PATCH', '/api/admin/error-logs/resolve', { data: body });
            const pass = r.status === 200 && r.data?.data?.changed === 1 && Array.isArray(r.data?.data?.ids);
            addResult({
                name: 'Error Logs Bulk Resolve (ids)', group: 'Error Logs', method: 'PATCH', path: '/api/admin/error-logs/resolve',
                purpose: 'Resolve many rows at once by id list (or by fingerprint to close every occurrence of an issue).',
                inputs: 'Body: { ids[] | fingerprint, resolved, note? }', curl: buildCurl('PATCH', '/api/admin/error-logs/resolve', {}, body),
                expected: '200 + data.changed=1', actual: r.status, pass,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        }
        if (errorLogFingerprint) {
            const body = { fingerprint: errorLogFingerprint, resolved: false };
            const r = await request('PATCH', '/api/admin/error-logs/resolve', { data: body });
            const pass = r.status === 200 && typeof r.data?.data?.changed === 'number' && r.data.data.changed >= 1;
            addResult({
                name: 'Error Logs Bulk Reopen (fingerprint)', group: 'Error Logs', method: 'PATCH', path: '/api/admin/error-logs/resolve',
                purpose: 'Reopen every row sharing a fingerprint (restores the test row to unresolved).',
                inputs: 'Body: { fingerprint, resolved: false }', curl: buildCurl('PATCH', '/api/admin/error-logs/resolve', {}, body),
                expected: '200 + data.changed>=1', actual: r.status, pass,
                latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
            });
        } else {
            // No fingerprint on the row: restore its original state by id instead.
            await request('PATCH', `/api/admin/error-logs/${errorLogId}/resolve`, { data: { resolved: Boolean(errorLogWasResolved) } });
        }
        if (errorLogWasResolved === true) {
            // The row was resolved before the tests ran; put it back.
            await request('PATCH', `/api/admin/error-logs/${errorLogId}/resolve`, { data: { resolved: true, note: 'restored by automated test' } });
        }
    } else {
        console.log('  ⚠️  No error log rows in the table — skipping detail / resolve tests');
    }
    {
        const body = { resolved: true };
        const r = await request('PATCH', '/api/admin/error-logs/resolve', { data: body });
        addResult({
            name: 'Error Logs Bulk Resolve (INVALID — expect 400)', group: 'Error Logs', method: 'PATCH', path: '/api/admin/error-logs/resolve',
            purpose: 'Exactly one of ids[] or fingerprint is required.',
            inputs: 'Body: { resolved: true } (no target)', curl: buildCurl('PATCH', '/api/admin/error-logs/resolve', {}, body),
            expected: '400 VALIDATION_ERROR', actual: r.status, pass: r.status === 400 && r.data?.error?.code === 'VALIDATION_ERROR',
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const body = { ids: ['not-a-uuid'] };
        const r = await request('POST', '/api/admin/error-logs/bulk-delete', { data: body });
        addResult({
            name: 'Error Logs Bulk Delete (INVALID — expect 400)', group: 'Error Logs', method: 'POST', path: '/api/admin/error-logs/bulk-delete',
            purpose: 'ids must be UUIDs; nothing is deleted on validation failure.',
            inputs: 'Body: { ids: ["not-a-uuid"] }', curl: buildCurl('POST', '/api/admin/error-logs/bulk-delete', {}, body),
            expected: '400 VALIDATION_ERROR', actual: r.status, pass: r.status === 400 && r.data?.error?.code === 'VALIDATION_ERROR',
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }
    {
        const id = '00000000-0000-4000-8000-000000000000';
        const r = await request('DELETE', `/api/admin/error-logs/${id}`);
        addResult({
            name: 'Error Log Delete (UNKNOWN id — expect 404)', group: 'Error Logs', method: 'DELETE', path: `/api/admin/error-logs/${id}`,
            purpose: 'Deleting an unknown row returns NOT_FOUND. (Real rows are not deleted by the test run.)',
            inputs: 'Path: id', curl: buildCurl('DELETE', `/api/admin/error-logs/${id}`),
            expected: '404 NOT_FOUND', actual: r.status, pass: r.status === 404 && r.data?.error?.code === 'NOT_FOUND',
            latency: r.latency, sample: truncate(r.data), errorDetail: r.error,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // G) Authentication Negative Tests
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n── G) Auth Negative Tests ──');
    {
        const r = await request('GET', '/api/admin/overview', { headers: { Authorization: '' } });
        // Override authHeaders for this call
        const url = `${BASE_URL}/api/admin/overview`;
        const start = Date.now();
        let res;
        try {
            res = await axios.get(url, { timeout: 5000, validateStatus: () => true });
        } catch (e) {
            res = { status: 0, data: null };
        }
        const latency = Date.now() - start;
        addResult({
            name: 'No Auth Header', group: 'Auth Negative', method: 'GET', path: '/api/admin/overview',
            purpose: 'Verify that missing Authorization header returns 401.',
            inputs: 'No Authorization header',
            curl: `curl -s "${url}"`,
            expected: '401', actual: res.status, pass: res.status === 401,
            latency, sample: truncate(res.data), errorDetail: null,
        });
    }
    {
        const url = `${BASE_URL}/api/admin/overview`;
        const start = Date.now();
        let res;
        try {
            res = await axios.get(url, { headers: { Authorization: 'Bearer wrong_token_12345' }, timeout: 5000, validateStatus: () => true });
        } catch (e) {
            res = { status: 0, data: null };
        }
        const latency = Date.now() - start;
        addResult({
            name: 'Wrong Token', group: 'Auth Negative', method: 'GET', path: '/api/admin/overview',
            purpose: 'Verify that wrong Bearer token returns 403.',
            inputs: 'Authorization: Bearer wrong_token',
            curl: `curl -s -H "Authorization: Bearer wrong_token" "${url}"`,
            expected: '403', actual: res.status, pass: res.status === 403,
            latency, sample: truncate(res.data), errorDetail: null,
        });
    }

    // ════════════════════════════════════════════════════════════════════════
    // Generate report
    // ════════════════════════════════════════════════════════════════════════
    generateReport();
}

// ── Report generator ────────────────────────────────────────────────────────

function generateReport() {
    const passed = results.filter(r => r.pass).length;
    const failed = results.filter(r => !r.pass).length;
    const total = results.length;
    const avgLatency = Math.round(results.reduce((s, r) => s + r.latency, 0) / total);

    console.log('\n' + '═'.repeat(70));
    console.log(`  Results: ${passed}/${total} passed, ${failed} failed, avg latency ${avgLatency}ms`);
    console.log('═'.repeat(70) + '\n');

    const timestamp = new Date().toISOString();
    let md = '';

    // Title
    md += `# Admin Dashboard API — Test Report\n\n`;
    md += `**Generated:** ${timestamp}  \n`;
    md += `**Base URL:** \`${BASE_URL}\`  \n`;
    md += `**Admin Token:** \`[REDACTED]\`  \n\n`;
    md += `---\n\n`;

    // Summary
    md += `## Summary\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Tests | ${total} |\n`;
    md += `| ✅ Passed | ${passed} |\n`;
    md += `| ❌ Failed | ${failed} |\n`;
    md += `| Avg Latency | ${avgLatency}ms |\n\n`;

    // Summary table
    md += `### All Tests\n\n`;
    md += `| # | Method | Endpoint | Expected | Actual | Result | Latency |\n`;
    md += `|---|--------|----------|----------|--------|--------|--------|\n`;
    results.forEach((r, i) => {
        const pf = r.pass ? '✅ PASS' : '❌ FAIL';
        md += `| ${i + 1} | ${r.method} | \`${r.path}\` | ${r.expected} | ${r.actual} | ${pf} | ${dur(r.latency)} |\n`;
    });
    md += '\n---\n\n';

    // Detailed per-endpoint sections
    const groups = [...new Set(results.map(r => r.group))];
    for (const group of groups) {
        md += `## ${group}\n\n`;
        const groupResults = results.filter(r => r.group === group);
        for (const r of groupResults) {
            const pf = r.pass ? '✅ PASS' : '❌ FAIL';
            md += `### ${r.name}\n\n`;
            md += `**Purpose:** ${r.purpose}\n\n`;
            md += `**Inputs:** ${r.inputs}\n\n`;
            md += `**Example curl:**\n\`\`\`bash\n${r.curl}\n\`\`\`\n\n`;
            md += `**Test Result:** ${pf} — Status: \`${r.actual}\` — Latency: \`${dur(r.latency)}\`\n\n`;
            if (r.sample) {
                md += `<details><summary>Response sample</summary>\n\n\`\`\`json\n${r.sample}\n\`\`\`\n</details>\n\n`;
            }
            if (r.errorDetail) {
                md += `> ⚠️ **Note:** ${r.errorDetail}\n\n`;
            }
        }
        md += `---\n\n`;
    }

    // Failed tests
    const failedResults = results.filter(r => !r.pass);
    if (failedResults.length > 0) {
        md += `## ❌ Failed Tests — Debugging Hints\n\n`;
        for (const r of failedResults) {
            md += `### ${r.name} (${r.method} ${r.path})\n\n`;
            md += `- **Expected:** ${r.expected}\n`;
            md += `- **Actual:** ${r.actual}\n`;
            if (r.errorDetail) md += `- **Error:** ${r.errorDetail}\n`;
            md += `- **Hints:**\n`;
            if (r.actual === 401) md += `  - Check ADMIN_TOKEN environment variable\n`;
            else if (r.actual === 403) md += `  - Token is invalid or does not match server ADMIN_TOKEN\n`;
            else if (r.actual === 0) md += `  - Server is unreachable — is it running?\n`;
            else if (r.actual === 500) md += `  - Internal server error — check DB connectivity and server logs\n`;
            else if (r.actual === 404) md += `  - Resource not found — verify seed data exists in DB\n`;
            else md += `  - Review server logs for request ID in response\n`;
            md += '\n';
        }
        md += `---\n\n`;
    }

    md += `*End of report.*\n`;

    const reportPath = path.join(__dirname, '..', 'api_test_report.md');
    fs.writeFileSync(reportPath, md);
    console.log(`📄 Report written to: ${reportPath}`);

    if (failed > 0) {
        console.log(`\n❌ ${failed} test(s) failed. See report for details.\n`);
        process.exit(2);
    } else {
        console.log(`\n✅ All ${total} tests passed!\n`);
    }
}

// ── Run ─────────────────────────────────────────────────────────────────────
runTests().catch(err => {
    console.error('Fatal error running tests:', err);
    process.exit(1);
});
