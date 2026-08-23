import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('mobileRouter task routes', () => {
  it('registers task list and detail routes under the shared workspace layout', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'),
      'utf8',
    );

    expect(source).toContain("import('@/routes/(main)/(task-workspace)/_layout')");
    expect(source).toContain("import('@/routes/(main)/tasks')");
    expect(source).toContain("import('@/routes/(main)/task/[taskId]')");
    expect(source).toContain("import('@/routes/(main)/agent/task/[taskId]')");
    expect(source).toContain("path: 'tasks'");
    expect(source).toContain("path: 'task'");
    expect(source).toContain("path: ':taskId'");
    expect(source).toContain("path: ':aid/task/:taskId'");
    expect(source).not.toContain("import('@/routes/(main)/tasks/_layout')");
  });
});

describe('mobileRouter image generation routes', () => {
  it('registers the mobile image page and layout in the shared main area', async () => {
    const source = await readFile(
      path.join(process.cwd(), 'src/spa/router/mobileRouter.config.tsx'),
      'utf8',
    );

    expect(source).toContain("import('@/routes/(mobile)/image')");
    expect(source).toContain("import('@/routes/(mobile)/image/_layout')");
    expect(source).toContain("path: 'image'");
  });

  it('keeps the image route in the mobile bottom navigation', async () => {
    const [layoutSource, navSource] = await Promise.all([
      readFile(path.join(process.cwd(), 'src/routes/(mobile)/_layout/index.tsx'), 'utf8'),
      readFile(path.join(process.cwd(), 'src/routes/(mobile)/_layout/NavBar.tsx'), 'utf8'),
    ]);

    expect(layoutSource).toContain("'/image'");
    expect(layoutSource).toContain("pathname.endsWith('/image')");
    expect(navSource).toContain('key: SidebarTabKey.Image');
    expect(navSource).toContain("navigate('/image')");
    expect(navSource).toContain("pathname.endsWith('/image')");
  });
});
