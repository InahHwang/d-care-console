// /src/components/widget/InboundWidget.tsx

'use client';

import { useEffect, useState } from 'react';
import WidgetContainer from './WidgetContainer';

interface InboundWidgetProps {
  isVisible?: boolean;
}

const InboundWidget: React.FC<InboundWidgetProps> = ({ isVisible = true }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 서버 사이드 렌더링 시에는 렌더링하지 않음
  if (!isMounted || !isVisible) {
    return null;
  }

  return <WidgetContainer />;
};

export default InboundWidget;