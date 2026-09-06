import { Flexbox } from '@lobehub/ui';
import { Text } from '@lobehub/ui/base-ui';
import { Divider } from 'antd';
import { type FC, type ReactNode } from 'react';

interface SettingHeaderProps {
  extra?: ReactNode;
  title: ReactNode;
}

const SettingHeader: FC<SettingHeaderProps> = ({ title, extra }) => {
  return (
    <Flexbox
      data-settings-section-header
      data-has-extra={!!extra}
      gap={24}
      style={{ paddingTop: 12 }}
    >
      <Flexbox horizontal align={'center'} justify={'space-between'}>
        <Text data-settings-title strong fontSize={24}>
          {title}
        </Text>
        {extra}
      </Flexbox>
      <Divider data-settings-title style={{ margin: 0 }} />
    </Flexbox>
  );
};

export default SettingHeader;
