import { type FlexboxProps } from '@lobehub/ui';
import { Flexbox } from '@lobehub/ui';
import { type ReactNode } from 'react';

import { mobileStyles } from '@/features/MobileApp/styles';

interface MobileContentLayoutProps extends FlexboxProps {
  header?: ReactNode;
  scrollable?: boolean;
  withNav?: boolean;
}

const MobileContentLayout = ({
  children,
  withNav,
  style,
  header,
  scrollable = true,
  id = 'lobe-mobile-scroll-container',
  ...rest
}: MobileContentLayoutProps) => {
  return (
    <Flexbox className={mobileStyles.page} style={{ overflow: 'hidden', position: 'relative' }}>
      {header}
      <Flexbox
        flex={1}
        id={id}
        width="100%"
        style={{
          minHeight: 0,
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: scrollable ? 'auto' : 'hidden',
          overscrollBehavior: 'contain',
          position: 'relative',
          ...style,
          paddingBottom: withNav ? 'var(--mobile-legacy-nav-padding, 48px)' : style?.paddingBottom,
        }}
        {...rest}
      >
        {children}
      </Flexbox>
    </Flexbox>
  );
};

export default MobileContentLayout;
