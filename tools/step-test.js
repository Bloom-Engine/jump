// Step through Play Game → Level Select → first level, screenshotting each stage.
const p = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
(async () => {
  const b = await p.launch({ executablePath: CHROME, headless: 'new',
    protocolTimeout: 60000,
    args: ['--no-sandbox', '--enable-unsafe-webgpu', '--use-angle=metal'] });
  const page = await b.newPage();
  // Small viewport = cheaper frames — headless Chrome's rAF pins 100% CPU at
  // 1024×768 with bloom's failing 3D shaders, blocking CDP.captureScreenshot.
  await page.setViewport({ width: 384, height: 288 });
  page.on('pageerror', (e) => console.log('[ERR]', e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (t.startsWith('mem_call:') || t.startsWith('  result:')) return;
    if (t.includes('WGSL') || t.includes('ShaderModule') || t.includes('CreateShader') || t.includes('textureSample')) return;
    console.log(`[${m.type()}]`, t);
  });
  await page.goto('http://localhost:8080/', { waitUntil: 'domcontentloaded', timeout: 8000 });
  await new Promise((r) => setTimeout(r, 3000));
  await page.screenshot({ path: '/tmp/step1-title.png' });
  console.log('STEP 1 title → /tmp/step1-title.png');
  await page.keyboard.down('Enter').catch(() => {});
  await new Promise((r) => setTimeout(r, 60));
  await page.keyboard.up('Enter').catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  await page.screenshot({ path: '/tmp/step2-level-select.png' });
  console.log('STEP 2 level-select → /tmp/step2-level-select.png');
  await page.keyboard.down('Enter').catch(() => {});
  await new Promise((r) => setTimeout(r, 60));
  await page.keyboard.up('Enter').catch(() => {});
  await new Promise((r) => setTimeout(r, 5000));
  // Screenshot on a deadline — if Chrome's rAF loop is saturating CPU, CDP
  // Page.captureScreenshot may queue behind frame work.
  try {
    await Promise.race([
      page.screenshot({ path: '/tmp/step3-in-game.png' }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('screenshot 15s timeout')), 15000)),
    ]);
    console.log('STEP 3 in-game → /tmp/step3-in-game.png');
  } catch (e) {
    console.log('STEP 3 screenshot failed: ' + e.message);
  }
  b.close().catch(() => {});
  setTimeout(() => process.exit(0), 500);
})().catch((e) => { console.error(e); process.exit(1); });
