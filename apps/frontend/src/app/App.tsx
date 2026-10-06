import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App as AntApp, ConfigProvider, theme } from 'antd';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ME_QUERY_KEY } from '../entities/session/api/session';
import { ApiError } from '../shared/api/httpClient';
import { ANTD_LOCALES, useLanguageStore } from '../shared/i18n';
import { Layout } from './Layout';
import { RequireAuth } from './RequireAuth';
import { DashboardPage } from '../pages/dashboard/DashboardPage';
import { LongTermPage } from '../pages/long-term/LongTermPage';
import { TradesPage } from '../pages/trades/TradesPage';
import { AnalyticsPage } from '../pages/analytics/AnalyticsPage';
import { SettingsPage } from '../pages/settings/SettingsPage';
import { LoginPage } from '../pages/login/LoginPage';
import { RegisterPage } from '../pages/register/RegisterPage';
import { AdminPage } from '../pages/admin/AdminPage';

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    // Session expired or revoked mid-visit: any 401 sends the user back to the login page.
    onError: (err) => {
      if (err instanceof ApiError && err.status === 401) queryClient.setQueryData(ME_QUERY_KEY, null);
    },
  }),
});

export default function App() {
  const language = useLanguageStore((s) => s.language);

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }} locale={ANTD_LOCALES[language]}>
        <AntApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<RequireAuth guestOnly><LoginPage /></RequireAuth>} />
            <Route path="/register" element={<RequireAuth guestOnly><RegisterPage /></RequireAuth>} />
            <Route path="/admin" element={<RequireAuth superAdmin><AdminPage /></RequireAuth>} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<DashboardPage />} />
              <Route path="/long-term" element={<LongTermPage />} />
              <Route path="/trades" element={<TradesPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
