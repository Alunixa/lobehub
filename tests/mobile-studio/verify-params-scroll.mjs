import assert from 'node:assert/strict';

import { expect } from '@playwright/test';

export const scrollState = (page) =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('div'))
      .filter((node) => /auto|scroll/.test(getComputedStyle(node).overflowY))
      .map((node) => ({
        className: node.className,
        height: node.clientHeight,
        overflow: getComputedStyle(node).overflowY,
        overscroll: getComputedStyle(node).overscrollBehaviorY,
        scrollHeight: node.scrollHeight,
        scrollTop: node.scrollTop,
      })),
  );

// Real trusted touch input, not element.scrollTop or scrollIntoView: nested
// non-scrolling containers can swallow a swipe even when CSS overflow exists.
export const swipe = async (page, session, upward = true) => {
  const { height } = page.viewportSize();
  const start = upward ? Math.min(height - 75, 600) : 170;
  const end = upward ? 170 : Math.min(height - 75, 600);
  await session.send('Input.dispatchTouchEvent', {
    touchPoints: [{ x: 65, y: start }],
    type: 'touchStart',
  });
  for (let step = 1; step <= 12; step++) {
    await session.send('Input.dispatchTouchEvent', {
      touchPoints: [{ x: 65, y: start + ((end - start) * step) / 12 }],
      type: 'touchMove',
    });
    await page.waitForTimeout(16);
  }
  await session.send('Input.dispatchTouchEvent', { touchPoints: [], type: 'touchEnd' });
  await page.waitForTimeout(300);
};

export const verifyParamsScroll = async ({ page, open, capture, assertions, requests, setMobile }) => {
  const session = await page.context().newCDPSession(page);
  try {
    await page.addInitScript(() => {
      localStorage.setItem('lobehub-chat-input-params-advanced-open', 'true');
    });
    for (const [width, height] of [[390, 844], [320, 568], [390, 430], [844, 390]]) {
      await page.setViewportSize({ width, height });
      await open('/agent/agt_preview/settings?section=params');
      await expect(page.getByRole('tab', { name: '高级参数', exact: true })).toBeVisible();
      await capture(`params-${width}x${height}-initial`);
      const header = page.getByRole('heading', { name: '会话设置', exact: true });
      const headerBefore = await header.boundingBox();
      const before = await scrollState(page);
      await swipe(page, session);
      const after = await scrollState(page);
      console.info('PARAMS_TOUCH_SCROLL', JSON.stringify({ width, height, before, after }));
      assert(
        after.some((item, index) => item.scrollTop > (before[index]?.scrollTop ?? 0) + 20),
        'A native finger swipe on parameter content must scroll the settings page',
      );
      const bottom = page.getByText('推理强度', { exact: true });
      for (let attempt = 0; attempt < 10; attempt++) {
        const box = await bottom.boundingBox();
        if (box && box.y >= 140 && box.y + box.height < height - 15) break;
        await swipe(page, session);
      }
      await expect(bottom).toBeInViewport();
      assert.equal((await header.boundingBox()).y, headerBefore.y, 'Header stays fixed');
      assert(
        !(await page.evaluate(() =>
          document.activeElement?.matches('input,textarea,[contenteditable="true"]'),
        )),
        'Swiping must not open a keyboard',
      );
      await capture(`params-${width}x${height}-bottom`);
      if (width === 390 && height === 844) {
        await page.evaluate(() => {
          window.__paramsEvents = [];
          for (const type of ['pointerdown', 'pointerup', 'click', 'change']) {
            document.addEventListener(type, (event) => {
              window.__paramsEvents.push({
                type, target: event.target?.outerHTML?.slice(0, 500),
              });
            }, true);
          }
        });
        const reasoning = page.locator('.control-row').filter({
          has: page.getByText('推理强度', { exact: true }),
        });
        await reasoning.getByRole('switch').tap();
        await page.waitForTimeout(700);
        console.info('PARAMS_SWITCH_EVENTS', JSON.stringify(await page.evaluate(() => window.__paramsEvents)));
        await expect(reasoning.getByRole('switch')).toBeChecked();
        await reasoning.getByRole('combobox').tap();
        await page.getByRole('option', { name: '高', exact: true }).tap();
        await expect.poll(() => requests.some(({ method, input }) =>
          method === 'agent.updateAgentConfig' && input.value?.params?.reasoning_effort === 'high',
        )).toBe(true);
        assert(!(await page.evaluate(() =>
          document.activeElement?.matches('input,textarea,[contenteditable="true"]'),
        )), 'Switches and parameter selects must not open a keyboard');
      }

      for (let attempt = 0; attempt < 10; attempt++) {
        if ((await scrollState(page)).every((item) => item.scrollTop < 1)) break;
        await swipe(page, session, false);
      }
      assert((await scrollState(page)).every((item) => item.scrollTop < 1), 'Can swipe back to top');
      await expect(page.getByText('聊天参数设置', { exact: true })).toBeInViewport();
      if (width === 390 && height === 844) {
        const history = page.locator('.control-row').filter({
          has: page.getByText('限制历史消息', { exact: true }),
        });
        const count = history.locator('input:not([type="hidden"]):not([type="checkbox"])');
        await count.tap();
        await expect(count).toBeFocused();
        await count.fill('16');
        await header.tap();
        await expect.poll(() => requests.some(({ method, input }) =>
          method === 'agent.updateAgentConfig' && input.value?.chatConfig?.historyCount === 16,
        )).toBe(true);
        const textarea = page.locator('textarea');
        await expect(textarea).not.toBeFocused();
        await expect(textarea).toBeInViewport();
        await textarea.tap();
        await expect(textarea).toBeFocused();
        await textarea.fill('手机高级参数输入回归');
        await header.tap();
        await expect(textarea).not.toBeFocused();
        await expect.poll(() => requests.some(({ method, input }) =>
          method === 'agent.updateAgentConfig' &&
          input.value?.chatConfig?.inputTemplate === '手机高级参数输入回归',
        )).toBe(true);
        const advanced = page.getByRole('button', { name: '高级设置', exact: true });
        await advanced.tap();
        await expect(advanced).toHaveAttribute('aria-expanded', 'false');
        await advanced.tap();
        await expect(advanced).toHaveAttribute('aria-expanded', 'true');
      }
      assertions.push(`${width}x${height}: native touch reaches the final parameter and returns to top without moving header or focusing inputs`);
    }
    await page.getByRole('button', { name: '返回', exact: true }).tap();
    await expect(page.locator('[contenteditable="true"]').first()).toBeVisible();
    await expect(page.locator('[contenteditable="true"]').first()).not.toBeFocused();
    assertions.push('Manual numeric/text input, switches and selects save; collapse/expand and return to chat preserve direct-input-only focus');

    setMobile(false);
    await page.setViewportSize({ width: 1440, height: 700 });
    await open('/agent/agt_preview');
    await page.getByRole('button', { name: '聊天参数设置', exact: true }).click();
    const sidebar = page.locator('[data-variant="sidebar"]').first();
    await expect(sidebar).toBeVisible();
    const sidebarBody = sidebar.locator('[data-variant="sidebar"]');
    const sidebarBefore = await sidebarBody.evaluate((node) => node.scrollTop);
    await sidebarBody.hover();
    await page.mouse.wheel(0, 1600);
    await expect.poll(() => sidebarBody.evaluate((node) => node.scrollTop)).toBeGreaterThan(sidebarBefore);
    await expect(sidebar.getByText('推理强度', { exact: true })).toBeInViewport();
    await capture('params-desktop-sidebar-bottom');
    await page.getByRole('button', { name: '聊天参数设置', exact: true }).click();
    await expect(sidebar).not.toBeVisible();
    assertions.push('Desktop parameter sidebar retains internal wheel scrolling, reaches the last control and closes normally');
  } finally {
    await session.detach();
  }
};
