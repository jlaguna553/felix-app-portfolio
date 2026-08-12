'use client';

import { useEffect } from 'react';

const ENDPOINT = process.env.NEXT_PUBLIC_QA_ARCHITECT_ENDPOINT;

export function QaArchitectProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!ENDPOINT) return;

    import('@qa-architect/sdk-js').then(({ initQaArchitect }) => {
      initQaArchitect({
        endpoint: ENDPOINT,
        captureNetwork: true,
        captureEvents: true,
        captureScreenshots: true,
        localFilter: 'localhost',
      });
    });
  }, []);

  return <>{children}</>;
}
