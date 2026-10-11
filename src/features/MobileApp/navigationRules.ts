export type MobileDestination = 'chat' | 'community' | 'image' | 'me' | 'tools';

export const resolveMobileNavigation = (pathname: string, workspaceSlug?: string | null) => {
  const prefix = workspaceSlug ? `/${workspaceSlug}` : '';
  const scopedPath =
    prefix && (pathname === prefix || pathname.startsWith(`${prefix}/`))
      ? pathname.slice(prefix.length) || '/'
      : pathname;
  const path = scopedPath.replace(/\/+$/, '') || '/';
  const active: MobileDestination = path.startsWith('/community')
    ? 'community'
    : path === '/image' || path === '/video'
      ? 'image'
      : path.startsWith('/me')
        ? 'me'
        : path === '/tools' || path.startsWith('/task')
          ? 'tools'
          : 'chat';

  const showNav =
    ['/', '/image', '/video', '/tools', '/tasks', '/me'].includes(path) ||
    /^\/community(?:\/(?:agent|model|provider|mcp|plugin))?$/.test(path);

  return { active, showNav };
};
