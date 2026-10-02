import { Alert, Button, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { homePathFor, useForgotPassword, useLogin } from '../../entities/session/api/session';
import { ApiError } from '../../shared/api/httpClient';
import { SUPPORT_TELEGRAM_URL } from '../../shared/config/support';
import { translateError, useT } from '../../shared/i18n';
import { AuthCard } from '../../widgets/auth-card/AuthCard';

function ForgotPassword() {
  const t = useT();
  const forgot = useForgotPassword();
  const error = forgot.error instanceof ApiError ? translateError(t, forgot.error.code, forgot.error.status) : null;

  if (forgot.isSuccess) {
    return <Alert type="success" showIcon style={{ marginTop: 16 }} title={t('auth.forgotSent')} />;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <Typography.Paragraph type="secondary">{t('auth.forgotPhoneText')}</Typography.Paragraph>
      <Form layout="vertical" requiredMark={false} onFinish={({ phone }: { phone: string }) => forgot.mutate(phone.trim())}>
        <Form.Item name="phone" label={t('auth.phone')} rules={[{ required: true, whitespace: true, message: t('auth.phoneRequired') }]}>
          <Input type="tel" autoComplete="tel" inputMode="tel" placeholder={t('auth.phonePlaceholder')} />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Button htmlType="submit" block loading={forgot.isPending}>
          {t('auth.forgotSend')}
        </Button>
      </Form>
      {SUPPORT_TELEGRAM_URL && (
        <Button type="link" block href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noopener noreferrer" style={{ marginTop: 8 }}>
          {t('auth.writeTelegram')}
        </Button>
      )}
    </div>
  );
}

export function LoginPage() {
  const t = useT();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const [showForgot, setShowForgot] = useState(false);
  const from = (location.state as { from?: string } | null)?.from;

  const onFinish = async (values: { email: string; password: string }) => {
    try {
      const { account } = await login.mutateAsync({ email: values.email.trim(), password: values.password });
      // The super admin always opens its own panel; everyone else returns to where they were going.
      navigate(account.role === 'SUPERADMIN' ? homePathFor(account) : (from ?? '/'), { replace: true });
    } catch {
      // shown below via login.error
    }
  };

  const error = login.error instanceof ApiError ? translateError(t, login.error.code, login.error.status) : null;

  return (
    <AuthCard title={t('auth.loginTitle')}>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="email" label={t('auth.email')} rules={[{ required: true, message: t('auth.emailRequired') }]}>
          <Input type="email" autoComplete="email" inputMode="email" />
        </Form.Item>
        <Form.Item name="password" label={t('auth.password')} rules={[{ required: true, message: t('auth.passwordRequired') }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Button type="primary" htmlType="submit" block loading={login.isPending}>
          {t('auth.submitLogin')}
        </Button>
      </Form>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <Typography.Link onClick={() => setShowForgot((v) => !v)}>{t('auth.forgot')}</Typography.Link>
        <span>
          {t('auth.noAccount')} <Link to="/register">{t('auth.registerTitle')}</Link>
        </span>
      </div>

      {showForgot && <ForgotPassword />}
    </AuthCard>
  );
}
