import { App, Button, Form, Input, Modal } from 'antd';
import { useState } from 'react';
import { useChangePassword } from '../../../entities/session/api/session';
import { ApiError } from '../../../shared/api/httpClient';
import { translateError, useT } from '../../../shared/i18n';

interface FormValues {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** «Сменить пароль» for the signed-in account. */
export function ChangePasswordButton() {
  const t = useT();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const change = useChangePassword();

  const close = () => {
    setOpen(false);
    form.resetFields();
    change.reset();
  };

  const submit = async () => {
    const { currentPassword, newPassword } = await form.validateFields();
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      message.success(t('account.passwordChanged'));
      close();
    } catch (err) {
      message.error(err instanceof ApiError ? translateError(t, err.code, err.status) : String(err));
    }
  };

  return (
    <>
      <Button size="small" onClick={() => setOpen(true)}>
        {t('account.changePassword')}
      </Button>
      <Modal
        open={open}
        title={t('account.changePassword')}
        okText={t('admin.save')}
        cancelText={t('admin.cancel')}
        onOk={submit}
        onCancel={close}
        confirmLoading={change.isPending}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item name="currentPassword" label={t('account.currentPassword')} rules={[{ required: true, message: t('auth.passwordRequired') }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label={t('admin.newPassword')}
            extra={t('auth.passwordHint')}
            rules={[
              { required: true, message: t('auth.passwordRequired') },
              { min: 8, message: t('error.PASSWORD_TOO_SHORT') },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label={t('account.confirmPassword')}
            dependencies={['newPassword']}
            rules={[
              { required: true, message: t('auth.passwordRequired') },
              ({ getFieldValue }) => ({
                validator: (_, value?: string) =>
                  !value || value === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error(t('account.passwordMismatch'))),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
