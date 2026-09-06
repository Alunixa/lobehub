import { type ListItemProps } from '@lobehub/ui';
import { Avatar, List } from '@lobehub/ui';
import { useHover } from 'ahooks';
import { createStaticStyles, cx } from 'antd-style';
import { memo, useMemo, useRef } from 'react';

import GroupAvatar from '@/features/GroupAvatar';
import { useServerConfigStore } from '@/store/serverConfig';

const { Item } = List;

const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    container: css`
      position: relative;
      margin-block: 2px;
      padding-inline: 12px 16px;
      border-radius: ${cssVar.borderRadius};
    `,
    mobile: css`
      min-height: 76px;
      margin-block: 6px;
      padding: 14px 12px;
      border: 1px solid ${cssVar.colorBorderSecondary};
      border-radius: 14px;
      background: ${cssVar.colorBgContainer};
    `,
    title: css`
      line-height: 1.2;
    `,
  };
});

const ListItem = memo<
  ListItemProps & {
    avatar: string | { avatar: string; background?: string }[];
    avatarBackground?: string;
    type?: 'agent' | 'group' | 'inbox';
  }
>(({ avatar, avatarBackground, active, showAction, actions, title, type, ...props }) => {
  const ref = useRef(null);
  const isHovering = useHover(ref);
  const mobile = useServerConfigStore((s) => s.isMobile);

  const avatarRender = useMemo(() => {
    if (type === 'group') {
      const avatars = Array.isArray(avatar) ? avatar : [avatar];
      return <GroupAvatar avatars={avatars} size={40} />;
    }

    // For regular sessions, use the regular Avatar component
    return (
      <Avatar animation={isHovering} avatar={avatar} background={avatarBackground} size={40} />
    );
  }, [isHovering, avatar, avatarBackground, type]);

  return (
    <Item
      actions={actions}
      active={mobile ? false : active}
      avatar={avatarRender}
      className={cx(styles.container, mobile && styles.mobile)}
      ref={ref}
      showAction={actions && (isHovering || showAction || mobile)}
      title={<span className={styles.title}>{title}</span>}
      {...(props as any)}
    />
  );
});

export default ListItem;
