import assert from 'node:assert/strict';

import { expect } from '@playwright/test';

export const createMessageContentFixture = (origin) => {
  const files = new Map([
    [
      'file_user',
      {
        id: 'file_user',
        name: 'original.png',
        fileType: 'image/png',
        url: `${origin}/fixture.svg?original`,
      },
    ],
  ]);
  let items = [
    {
      agentId: 'agt_preview',
      content: '待编辑的历史消息',
      createdAt: 1,
      id: 'msg_user',
      role: 'user',
      topicId: 'tpc_preview_0',
      updatedAt: 1,
      imageList: [{ alt: 'original.png', id: 'file_user', url: `${origin}/fixture.svg?original` }],
    },
    {
      agentId: 'agt_preview',
      content: '保留这条已有回复',
      createdAt: 2,
      id: 'msg_assistant',
      parentId: 'msg_user',
      role: 'assistant',
      topicId: 'tpc_preview_0',
      updatedAt: 2,
    },
  ];
  let failNextSave = true;
  const withFiles = (fileIds) => ({
    fileList: fileIds
      .map((id) => files.get(id))
      .filter((file) => !file.fileType.startsWith('image/'))
      .map((file) => ({ ...file, content: 'UI fixture document contents', size: 10 })),
    imageList: fileIds
      .map((id) => files.get(id))
      .filter((file) => file.fileType.startsWith('image/'))
      .map((file) => ({ alt: file.name, id: file.id, url: file.url })),
  });
  return {
    get messages() {
      return items;
    },
    rpc(method, input) {
      if (method === 'message.getMessages') return { data: input.topicId ? items : [] };
      if (method === 'document.parseFileContent') return { data: { success: true } };
      if (method === 'file.checkFileHash')
        return { data: { isExist: true, metadata: { path: '/fixture.svg' }, url: '/fixture.svg' } };
      if (method === 'file.createFile') {
        const id = `content-file-${files.size}`;
        const file = { ...input, id, url: `${origin}/fixture.svg?${id}` };
        files.set(id, file);
        return { data: { id, url: file.url } };
      }
      if (method === 'message.editMessageContent') {
        if (failNextSave) {
          failNextSave = false;
          throw new Error('Expected fixture save failure');
        }
        items = items.map((item) =>
          item.id === input.id
            ? {
                ...item,
                content: input.content,
                editorData: input.editorData,
                updatedAt: Date.now(),
                ...withFiles(input.fileIds),
              }
            : item,
        );
        return { data: { messages: items, success: true } };
      }
      if (method === 'message.insertContextMessage') {
        if (items.some((item) => item.id === input.id))
          return { data: { id: input.id, messages: items, success: true } };
        const index = items.findIndex((item) => item.id === input.anchorId);
        assert(index >= 0);
        const anchor = items[index];
        const before = input.position === 'before';
        const inserted = {
          agentId: anchor.agentId,
          content: input.content,
          createdAt: Date.now(),
          editorData: input.editorData,
          id: input.id,
          metadata: { isCustomContext: true },
          parentId: before ? anchor.parentId : anchor.id,
          role: 'user',
          topicId: anchor.topicId,
          updatedAt: Date.now(),
          ...withFiles(input.fileIds),
        };
        if (before) anchor.parentId = inserted.id;
        else
          items = items.map((item) =>
            item.parentId === anchor.id ? { ...item, parentId: inserted.id } : item,
          );
        items.splice(index + (before ? 0 : 1), 0, inserted);
        return { data: { id: input.id, messages: items, success: true } };
      }
    },
  };
};

export const verifyMessageContent = async ({
  page,
  open,
  capture,
  setMobile,
  getFixture,
  requests,
  assertions,
}) => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
    'base64',
  );
  const route = '/agent/agt_preview/tpc_preview_0';
  const dialog = page.getByRole('dialog');
  const startEdit = async () => {
    await page.locator('#msg_user').dblclick();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('编辑消息与附件', { exact: true })).toBeVisible();
  };
  const startInsert = async () => {
    await page.getByText('保留这条已有回复', { exact: true }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: '在此处插入上下文', exact: true }).click();
    await expect(dialog).toBeVisible();
  };
  for (const desktop of [false, true]) {
    setMobile(!desktop);
    await page.setViewportSize(
      desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    );
    await open(route);
    await startEdit();
    const editor = dialog.locator('[contenteditable="true"]');
    if (!desktop) await expect(editor).not.toBeFocused();
    const saved = getFixture().messages[0];
    await expect(
      dialog.getByText(desktop ? 'added.png' : 'original.png', { exact: true }),
    ).toBeVisible();
    await editor.tap();
    await editor.fill(desktop ? '桌面编辑后的历史消息' : '手机编辑后的历史消息');
    const url = page.url();
    await editor.press('Shift+Enter');
    await editor.pressSequentially('第二行');
    assert.equal(page.url(), url, 'Shift+Enter must not navigate');
    if (!desktop) {
      await dialog
        .locator('input[type=file]')
        .setInputFiles({ buffer: png, mimeType: 'image/png', name: 'added.png' });
      await expect(dialog.getByText('added.png', { exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: '保存', exact: true }).click();
      await expect(dialog.getByText(/保存失败/)).toBeVisible();
      assert.equal(getFixture().messages[0].content, saved.content);
      await expect(dialog.getByRole('button', { name: '保存', exact: true })).toBeEnabled();
    }
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await open(route);
    await expect(page.locator('#msg_user')).toContainText(
      desktop ? '桌面编辑后的历史消息' : '手机编辑后的历史消息',
    );
    await expect(page.getByText('保留这条已有回复', { exact: true })).toBeVisible();
    if (!desktop) {
      assert.equal(getFixture().messages[0].imageList.length, 2);
      await startEdit();
      await dialog
        .getByText('original.png', { exact: true })
        .locator('..')
        .getByRole('button', { name: '移除', exact: true })
        .click();
      await dialog.getByRole('button', { name: '保存', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      assert.equal(getFixture().messages[0].imageList.length, 1);
      assertions.push(
        'Mobile edit retains old image, adds an attachment, preserves text/files after failed save, retries successfully and removes only the chosen attachment',
      );
    }
    await capture(desktop ? 'message-content-desktop-edited' : 'message-content-mobile-edited');
    await startInsert();
    const contextEditor = dialog.locator('[contenteditable="true"]');
    if (!desktop) await expect(contextEditor).not.toBeFocused();
    if (desktop) {
      await dialog.getByRole('combobox').click();
      await page.getByRole('option', { name: '在这条消息之前', exact: true }).click();
    }
    await contextEditor.tap();
    await contextEditor.fill(desktop ? '前置自定义上下文' : '附带文件的自定义上下文');
    if (!desktop) {
      await dialog
        .locator('input[type=file]')
        .setInputFiles({
          buffer: Buffer.from('important context'),
          mimeType: 'text/plain',
          name: 'context.txt',
        });
      await expect(dialog.getByText('context.txt', { exact: true })).toBeVisible();
    }
    await dialog.getByRole('button', { name: '保存', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await open(route);
    await expect(
      page.getByText(desktop ? '前置自定义上下文' : '附带文件的自定义上下文', { exact: true }),
    ).toBeVisible();
    const order = getFixture().messages.map((item) => item.content);
    const index = order.indexOf('保留这条已有回复');
    assert.equal(
      order[desktop ? index - 1 : index + 1],
      desktop ? '前置自定义上下文' : '附带文件的自定义上下文',
    );
    await capture(
      desktop ? 'message-content-desktop-inserted-before' : 'message-content-mobile-inserted-after',
    );
  }
  assert(requests.some(({ method }) => method === 'document.parseFileContent'));
  assert(
    !requests.some(({ method }) => /execAgent|createMessage|sendMessage|\/chat\//.test(method)),
  );
  assertions.push(
    'Desktop/mobile insertion saves at the selected before/after position with document attachments, survives reload, preserves existing replies, and makes no model request',
  );
};
