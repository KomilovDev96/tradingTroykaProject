import { Alert, Button, Form, Input } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister } from '../../entities/session/api/session';
import { ApiError } from '../../shared/api/httpClient';
import { translateError, useT } from '../../shared/i18n';
import { AuthCard } from '../../widgets/auth-card/AuthCard';

/** Same rules as the backend (src/auth/validation.ts), checked here first for instant feedback. */
const LATIN_NAME = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const MIN_PASSWORD_LENGTH = 8;
/** 9–15 digits with optional +, spaces, dashes, brackets (normalized server-side to +digits). */
const PHONE = /^\+?[\d\s()-]{9,20}$/;

export function RegisterPage() {
  const t = useT();
  const register = useRegister();
  const navigate = useNavigate();

  const onFinish = async (values: { name: string; email: string; phone: string; password: string }) => {
    try {
      await register.mutateAsync({ ...values, name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim() });
      navigate('/', { replace: true });
    } catch {
      // shown below via register.error
    }
  };

  const error = register.error instanceof ApiError ? translateError(t, register.error.code, register.error.status) : null;

  return (
    <AuthCard title={t('auth.registerTitle')}>
      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item
          name="name"
          label={t('auth.name')}
          rules={[
            { required: true, whitespace: true, message: t('auth.nameRequired') },
            {
              validator: (_, value?: string) => {
                const name = value?.trim() ?? '';
                return !name || (name.length >= 2 && name.length <= 50 && LATIN_NAME.test(name))
                  ? Promise.resolve()
                  : Promise.reject(new Error(t('error.NAME_INVALID')));
              },
            },
          ]}
        >
          <Input autoComplete="name" placeholder={t('auth.namePlaceholder')} />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('auth.email')}
          rules={[
            { required: true, message: t('auth.emailRequired') },
            { type: 'email', message: t('error.EMAIL_INVALID') },
          ]}
        >
          <Input type="email" autoComplete="email" inputMode="email" />
        </Form.Item>
        <Form.Item
          name="phone"
          label={t('auth.phone')}
          rules={[
            { required: true, whitespace: true, message: t('auth.phoneRequired') },
            { pattern: PHONE, message: t('error.PHONE_INVALID') },
          ]}
        >
          <Input type="tel" autoComplete="tel" inputMode="tel" placeholder={t('auth.phonePlaceholder')} />
        </Form.Item>
        <Form.Item
          name="password"
          label={t('auth.password')}
          extra={t('auth.passwordHint')}
          rules={[
            { required: true, message: t('auth.passwordRequired') },
            { min: MIN_PASSWORD_LENGTH, message: t('error.PASSWORD_TOO_SHORT') },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
        <Button type="primary" htmlType="submit" block loading={register.isPending}>
          {t('auth.submitRegister')}
        </Button>
      </Form>

      <div style={{ marginTop: 16 }}>
        {t('auth.haveAccount')} <Link to="/login">{t('auth.loginTitle')}</Link>
      </div>
    </AuthCard>
  );
}
