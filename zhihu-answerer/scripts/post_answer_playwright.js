#!/usr/bin/env node

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { mode: 'publish', productUrls: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    const val = argv[i + 1];
    if (!val || val.startsWith('--')) continue;
    if (key === '--url') args.url = val;
    if (key === '--content') args.content = val;
    if (key === '--mode') args.mode = val;
    if (key === '--headless') args.headless = val !== 'false';
    if (key === '--product-url') args.productUrls.push(val);
  }
  return args;
}

function parseCookieHeader(cookieHeader, domain = '.zhihu.com') {
  return cookieHeader
    .split(';')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((part) => {
      const eq = part.indexOf('=');
      const name = eq >= 0 ? part.slice(0, eq).trim() : part.trim();
      const value = eq >= 0 ? part.slice(eq + 1).trim() : '';
      return {
        name,
        value,
        domain,
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      };
    });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeRegExp(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countVisibleChars(text) {
  return (text || '').replace(/\s+/g, '').length;
}

function decodeEscapedNewlines(text) {
  return (text || '').replace(/\\n/g, '\n');
}

function expandHome(inputPath) {
  if (!inputPath) return inputPath;
  if (inputPath === '~') return process.env.HOME || '';
  if (inputPath.startsWith('~/')) return path.join(process.env.HOME || '', inputPath.slice(2));
  return inputPath;
}

function readCookieFromFile(cookieFilePath = '~/.config/zhihu_cookie.txt') {
  const resolved = path.resolve(expandHome(cookieFilePath));
  let cookieHeader = '';

  try {
    cookieHeader = fs.readFileSync(resolved, 'utf8').trim();
  } catch (_) {
    throw new Error(`Cannot read cookie file: ${resolved}`);
  }

  if (!cookieHeader) {
    throw new Error(`Cookie file is empty: ${resolved}`);
  }

  return cookieHeader;
}

function normalizeUrlToken(raw) {
  return raw.replace(/[),.!?;:，。！？；：、]+$/g, '');
}

function isEcomProductUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    return (
      host.includes('jd.com') ||
      host.includes('taobao.com') ||
      host.includes('tmall.com')
    );
  } catch (_) {
    return false;
  }
}

function extractProductUrlsAndSanitize(content) {
  const found = [];
  const urlRegex = /https?:\/\/[^\s<>'"`]+/g;

  const replaced = (content || '').replace(urlRegex, (matched) => {
    const clean = normalizeUrlToken(matched);
    if (isEcomProductUrl(clean)) {
      found.push(clean);
      return '';
    }
    return matched;
  });

  const cleanedText = replaced
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return {
    cleanedText,
    productUrls: [...new Set(found)]
  };
}

async function safeClick(locator, forceFallback = true) {
  if (!(await locator.count())) return false;
  try {
    await locator.first().click({ timeout: 5000 });
    return true;
  } catch (err) {
    if (!forceFallback) throw err;
    await locator.first().click({ force: true, timeout: 5000 });
    return true;
  }
}

async function clickByText(scope, labels) {
  for (const label of labels) {
    const locator = scope.getByRole('button', { name: label });
    if (await locator.count()) {
      try {
        await locator.last().click({ timeout: 5000 });
        return label;
      } catch (_) {
        try {
          await locator.last().click({ force: true, timeout: 5000 });
          return label;
        } catch (_) {
          // fall back to generic strategy
        }
      }
    }
    if (await safeClick(locator, true)) return label;
  }
  return null;
}

async function clickButtonExact(scope, labels) {
  for (const label of labels) {
    const locator = scope.locator('button').filter({ hasText: new RegExp(`^\\s*${escapeRegExp(label)}\\s*$`) });
    if (await safeClick(locator, true)) return label;
  }
  return null;
}

async function clickFirstVisible(scope, selectors) {
  for (const selector of selectors) {
    const locator = scope.locator(selector);
    if (await safeClick(locator, true)) return selector;
  }
  return null;
}

async function firstVisibleLocator(page, selectors, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if (await locator.count()) {
        try {
          await locator.waitFor({ state: 'visible', timeout: 400 });
          return locator;
        } catch (_) {
          // continue
        }
      }
    }
    await sleep(200);
  }
  return null;
}

async function waitForProfitFrame(page, timeoutMs = 12000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const f = page.frames().find((x) => x.url().includes('/selection/profit-selector'));
    if (f) return f;
    await sleep(200);
  }
  return null;
}

async function tryInsertProductCard(page, productUrl) {
  const editorBefore = await page.locator('[contenteditable="true"]').first().evaluate((el) => el.innerHTML.length);

  const opened =
    (await clickByText(page, ['收益'])) ||
    (await clickFirstVisible(page, ['button[aria-label="收益"]', 'button:has-text("收益")']));
  if (!opened) {
    return { inserted: false, reason: 'cannot-open-profit-entry' };
  }

  const frame = await waitForProfitFrame(page);
  if (!frame) {
    return { inserted: false, reason: 'profit-panel-not-opened' };
  }

  await safeClick(frame.getByText('好物推荐', { exact: false }).first(), true);
  await sleep(300);

  if (/jd\.com/i.test(productUrl)) {
    await safeClick(frame.getByText('京东', { exact: false }).first(), true);
    await sleep(300);
  } else if (/taobao\.com|tmall\.com/i.test(productUrl)) {
    await safeClick(frame.getByText('淘宝', { exact: false }).first(), true);
    await sleep(300);
  }

  let input = frame.locator('input[placeholder*="粘贴链接"], input[placeholder*="淘口令"]').first();
  if (!(await input.count())) input = frame.locator('.MCNSourceSelector-search input').last();
  if (!(await input.count())) input = frame.locator('input.Input').last();
  if (!(await input.count())) {
    return { inserted: false, reason: 'no-link-input' };
  }

  await input.waitFor({ state: 'visible', timeout: 10000 }).catch(() => null);
  await input.fill(productUrl);
  const trigger = input.locator('xpath=following-sibling::*[name()="svg"]').first();
  if (!(await safeClick(trigger, true))) {
    await input.press('Enter');
  }

  await sleep(2600);
  const panelText = await frame.locator('body').innerText().catch(() => '');
  if (panelText.includes('没有找到对应商品')) {
    return { inserted: false, reason: 'no-matching-product' };
  }

  const rowAdds = frame.locator('.MCNGoodSearch-goodListContainer button:has-text("添加"), .MCNGoodSearch-goodList button:has-text("添加")');
  const addCount = await rowAdds.count();
  if (addCount === 0) {
    return { inserted: false, reason: 'no-row-add-button' };
  }

  // If there are multiple candidates, skip to avoid inserting wrong item.
  if (addCount > 1) {
    return { inserted: false, reason: 'multiple-candidates' };
  }

  await rowAdds.first().click({ force: true });
  await sleep(700);

  const confirm = frame.getByRole('button', { name: '确定' }).first();
  if (await confirm.count()) {
    await confirm.click({ force: true });
    await sleep(1200);
  }

  try {
    const closeBtn = frame.getByRole('button', { name: /关闭|收起/ }).first();
    if (!(await safeClick(closeBtn, true))) {
      await page.keyboard.press('Escape').catch(() => {});
      await clickByText(page, ['收益']);
    }
  } catch (_) {
    // frame may detach
  }

  await sleep(600);
  const editorAfter = await page.locator('[contenteditable="true"]').first().evaluate((el) => el.innerHTML.length);
  if (editorAfter === editorBefore) {
    return { inserted: false, reason: 'editor-not-changed' };
  }

  return { inserted: true, reason: 'ok' };
}

async function openAnswerEditor(page) {
  const fromQuestionPage = await clickByText(page, ['编辑回答', '写回答', '发布回答']);
  if (fromQuestionPage) return;

  const viewMyAnswerLink = page.locator('a:has-text("查看我的回答")').first();
  if (await viewMyAnswerLink.count()) {
    const href = await viewMyAnswerLink.getAttribute('href');
    if (href) {
      const to = href.startsWith('http') ? href : `https://www.zhihu.com${href}`;
      await page.goto(to, { waitUntil: 'domcontentloaded' });
      await sleep(1000);
      const clicked = await clickByText(page, ['编辑回答', '编辑']);
      if (!clicked) throw new Error('Cannot find edit button on my answer page.');
      await sleep(700);
      return;
    }
  }

  const fallback = await clickByText(page, ['回答']);
  if (fallback) return;
  throw new Error('Cannot find answer entry (write/edit/view-my-answer).');
}

function resolveExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_PATH)) {
    return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }

  const defaultPath = chromium.executablePath();
  if (defaultPath && fs.existsSync(defaultPath)) return defaultPath;

  const cacheRoot = path.join(process.env.HOME || '', 'Library', 'Caches', 'ms-playwright');
  if (!fs.existsSync(cacheRoot)) return undefined;

  const candidates = [
    path.join(cacheRoot, 'chromium-1208', 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
    path.join(cacheRoot, 'chromium-1208', 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

async function publishAndVerify(page) {
  const waitPublishResponse = () =>
    page
      .waitForResponse(
        (resp) => resp.url().includes('/api/v4/content/publish') && resp.request().method() === 'POST',
        { timeout: 15000 }
      )
      .catch(() => null);

  let publishRespPromise = waitPublishResponse();
  const clicked = await clickButtonExact(page, ['提交修改', '发布回答', '发布']);
  if (!clicked) {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter').catch(() => {});
  }

  let publishResp = await publishRespPromise;
  if (!publishResp) {
    publishRespPromise = waitPublishResponse();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter').catch(() => {});
    publishResp = await publishRespPromise;
  }

  if (!publishResp) {
    throw new Error('Publish action did not trigger content/publish request.');
  }

  let payload = null;
  try {
    payload = await publishResp.json();
  } catch (_) {
    // ignore parse issue
  }

  if (!publishResp.ok()) {
    throw new Error(`Publish request failed with status ${publishResp.status()}.`);
  }

  if (payload && payload.error) {
    throw new Error(`Publish API error: ${payload.error.message || JSON.stringify(payload.error)}`);
  }

  return {
    status: publishResp.status(),
    hasResult: Boolean(payload && payload.data && payload.data.result)
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const cookieFilePath = '~/.config/zhihu_cookie.txt';
  let cookieHeader = '';

  if (!args.url || !args.content) {
    console.error('Usage: post_answer_playwright.js --url <question_url> --content <text> [--mode draft|publish] [--headless true|false] [--product-url <url> ...]');
    process.exit(1);
  }

  try {
    cookieHeader = readCookieFromFile(cookieFilePath);
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2));
    process.exit(1);
  }

  if (!['draft', 'publish'].includes(args.mode)) {
    console.error('Invalid mode. Use draft or publish.');
    process.exit(1);
  }

  const extracted = extractProductUrlsAndSanitize(args.content);
  const mergedProductUrls = [...new Set([...(args.productUrls || []), ...extracted.productUrls])];
  const cleanedContent = decodeEscapedNewlines(extracted.cleanedText);

  if (!cleanedContent) {
    console.error(JSON.stringify({ ok: false, error: 'Content becomes empty after removing product URLs.' }, null, 2));
    process.exit(1);
  }

  if (args.mode === 'publish' && mergedProductUrls.length > 0 && countVisibleChars(cleanedContent) < 200) {
    console.error(JSON.stringify({ ok: false, error: 'With product cards, publish content must be at least 200 visible chars after URL removal.' }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({
    headless: args.headless !== false,
    executablePath: resolveExecutablePath()
  });
  const context = await browser.newContext();

  try {
    const cookies = parseCookieHeader(cookieHeader);
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto('https://www.zhihu.com/', { waitUntil: 'domcontentloaded' });
    await sleep(1200);

    const loginButton = page.getByRole('button', { name: /登录|注册/ });
    if (await loginButton.count()) {
      throw new Error('Cookie seems invalid: login/register button still visible.');
    }

    await page.goto(args.url, { waitUntil: 'domcontentloaded' });
    await sleep(1200);
    await openAnswerEditor(page);

    const editor = await firstVisibleLocator(page, [
      '[contenteditable="true"]',
      '.DraftEditor-root [contenteditable="true"]',
      '[role="textbox"][contenteditable="true"]',
      'textarea'
    ]);
    if (!editor) throw new Error('Cannot find visible editor.');

    await editor.click();
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.type(cleanedContent, { delay: 2 });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    let insertedCount = 0;
    const skipped = [];
    for (const productUrl of mergedProductUrls) {
      try {
        const result = await tryInsertProductCard(page, productUrl);
        if (result.inserted) {
          insertedCount += 1;
        } else {
          skipped.push({ url: productUrl, reason: result.reason });
        }
      } catch (err) {
        skipped.push({ url: productUrl, reason: String(err.message || err) });
      }
    }

    let publishMeta = null;
    if (args.mode === 'publish') {
      publishMeta = await publishAndVerify(page);
    } else {
      const clicked = await clickByText(page, ['保存草稿', '存为草稿', '草稿']);
      if (!clicked) console.warn('Draft button not found; content has been filled in editor.');
    }

    await sleep(1200);
    console.log(JSON.stringify({
      ok: true,
      mode: args.mode,
      extractedProductUrls: extracted.productUrls.length,
      requestedProductUrls: mergedProductUrls.length,
      productCardsInserted: insertedCount,
      productCardsSkipped: skipped,
      publishVerified: Boolean(publishMeta),
      publishStatus: publishMeta ? publishMeta.status : null,
      contentVisibleChars: countVisibleChars(cleanedContent),
      title: await page.title(),
      finalUrl: page.url()
    }, null, 2));
  } catch (err) {
    console.error(JSON.stringify({ ok: false, error: String(err.message || err) }, null, 2));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
