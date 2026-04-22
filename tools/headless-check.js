// Headless smoke test: open http://localhost:8080, capture console + errors.
// Usage: node tools/headless-check.js [url] [wait_seconds]
const puppeteer = require('puppeteer-core');

const URL = process.argv[2] || 'http://localhost:8080/';
const WAIT_SEC = Number(process.argv[3] || 4);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Hard kill after this — prevents hung Chrome processes from eating the session.
const HARD_TIMEOUT_MS = (WAIT_SEC + 40) * 1000;
const killTimer = setTimeout(() => {
  console.error(`\n[HARD TIMEOUT after ${HARD_TIMEOUT_MS}ms]`);
  process.exit(2);
}, HARD_TIMEOUT_MS);

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=metal'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 768 });

  const events = [];
  page.on('console', (msg) => {
    const t = msg.text();
    if (t.startsWith('mem_call:') || t.startsWith('  result:')) return;
    events.push(`[${msg.type()}] ${t}`);
  });
  page.on('pageerror', (err) => events.push(`[pageerror] ${err.message}\n${err.stack || ''}`));
  page.on('requestfailed', (req) => events.push(`[reqfailed] ${req.url()} - ${req.failure()?.errorText}`));
  page.on('response', (r) => { if (!r.ok() && r.status() !== 304 && !r.url().endsWith('favicon.ico')) events.push(`[http ${r.status()}] ${r.url()}`); });

  // Fire goto but don't block on load — page may run a tight sync XHR loop.
  page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 8000 }).catch((e) => events.push(`[goto] ${e.message}`));

  // Let the title render.
  await new Promise((r) => setTimeout(r, Math.min(WAIT_SEC, 3) * 1000));

  // Hit Enter to select "Play Game", then Enter again to pick first level.
  if (process.argv.includes('--play')) {
    // Short Enter tap. Long press causes keyboard autorepeat → extra "confirms"
    // that blow past the level select screen.
    await page.keyboard.down('Enter').catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    await page.keyboard.up('Enter').catch(() => {});
    // Wait long enough for discoverLevels' blocking sync XHRs to finish.
    await new Promise((r) => setTimeout(r, 2500));
    await page.keyboard.down('Enter').catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    await page.keyboard.up('Enter').catch(() => {});
    // Wait for level to parse & first frame to render.
    await new Promise((r) => setTimeout(r, 3000));
  } else {
    await new Promise((r) => setTimeout(r, Math.max(0, WAIT_SEC - 3) * 1000));
  }

  // Screenshot only (evaluate tends to hang if the rAF loop is monopolizing the
  // main thread — the console/pageerror events above already tell us everything).
  await page.screenshot({ path: '/tmp/jump-web.png', fullPage: false })
    .catch((e) => events.push(`[screenshot] ${e.message}`));
  console.log('Screenshot: /tmp/jump-web.png');

  // Print results BEFORE closing the browser — browser.close() can hang when
  // a runaway rAF loop is keeping Chrome's render thread busy.
  clearTimeout(killTimer);
  console.log('=== Console + errors ===');
  for (const ev of events) console.log(ev);
  browser.close().catch(() => {});
  setTimeout(() => process.exit(0), 500);
})().catch((e) => { console.error(e); process.exit(1); });
