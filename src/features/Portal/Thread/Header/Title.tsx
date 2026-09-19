import { Skeleton } from '@lobehub/ui/base-ui';

import { useChatStore } from '@/store/chat';

import ActiveThread from './Active';
import NewThread from './New';

const Header = () => {
  const isInNew = useChatStore((s) => s.startToForkThread);

  const isInit = useChatStore((s) => s.threadsInit);

  if (!isInit && !isInNew) return <Skeleton height={22} width={160} />;

  return isInNew ? <NewThread /> : <ActiveThread />;
};

export default Header;
