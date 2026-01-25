// Phase 0.3: Global Providers (Theme, Language, Auth, Organization, WebSocket, Browser Notifications, i18n)

'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { I18nProvider } from '@/lib/i18n/I18nProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { OrganizationProvider } from '@/components/providers/OrganizationProvider';
import { WebSocketProvider } from '@/lib/websocket';
import { BrowserNotificationProvider } from '@/components/providers/BrowserNotificationProvider';
import { SupportAlertProvider } from '@/components/providers/SupportAlertProvider';
import { SupportStatusNotificationProvider } from '@/components/providers/SupportStatusNotificationProvider';
import { ToastProvider } from '@/components/ui/Toast';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <I18nProvider>
            <AuthProvider>
              <OrganizationProvider>
                <WebSocketProvider>
                  <BrowserNotificationProvider>
                    <SupportAlertProvider>
                      <SupportStatusNotificationProvider>
                        <ToastProvider>
                          {children}
                        </ToastProvider>
                      </SupportStatusNotificationProvider>
                    </SupportAlertProvider>
                  </BrowserNotificationProvider>
                </WebSocketProvider>
              </OrganizationProvider>
            </AuthProvider>
          </I18nProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
