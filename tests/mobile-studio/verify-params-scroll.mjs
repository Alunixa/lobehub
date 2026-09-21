import assert from 'node:assert/strict';

import { expect } from '@playwright/test';

const scrollState = (page) =>
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
const swipe = async (page, session, upward = true) => {
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

export const verifyParamsScroll = async ({ page, open, capture, assertions, requests }) => {
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

      for (let attempt = 0; attempt < 10; attempt++) {
        if ((await scrollState(page)).every((item) => item.scrollTop < 1)) break;
        await swipe(page, session, false);
      }
      assert((await scrollState(page)).every((item) => item.scrollTop < 1), 'Can swipe back to top');
      await expect(page.getByText('聊天参数设置', { exact: true })).toBeInViewport();
      if (width === 390 && height === 844) {
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
    assertions.push('Manual field input still works, saves, collapses/expands and returns to chat without autofocus');
  } finally {
    await session.detach();
  }
};
