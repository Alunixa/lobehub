import { type PropsWithChildren } from 'react';

import { MobileHomeLayout } from '@/features/MobileApp/Home';

const MobileLayout = ({ children }: PropsWithChildren) => {
  return <MobileHomeLayout>{children}</MobileHomeLayout>;
};

export default MobileLayout;
