import { App, Form, Input, Modal, Switch } from 'antd';
import { useEffect } from 'react';
import { useCreateUser, useUpdateUser, type AdminUser, type UserInput } from '../../entities/admin/api/admin';
import { ApiError } from '../../shared/api/httpClient';
import { translateError, useT } from '../../shared/i18n';

const LATIN_NAME = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
const PHONE = /^\+?[\d\s()-]{9,20}$/;

/** Create (user = null) or edit an account. On edit an empty password keeps the current one. */
export function UserFormModal({ open, user, onClose }: { open: boolean; user: AdminUser | null; onClose: () => void }) {
  const t = useT();
  const { message } = App.useApp();
  const [form] = Form.useForm<UserInput>();
  const create = useCreateUser();
  const update = useUpdateUser();
  const isEdit = user !== null;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    if (user) form.setFieldsValue({ name: user.name, email: user.email, phone: user.phone ?? '', analysisPaused: user.analysisPaused });
  }, [open, user, form]);

  const submit = async () => {
    const values = await form.validateFields();
    try {
      if (isEdit) {
        await update.mutateAsync({ id: user.id, ...values, password: values.password || undefined });
        message.success(t('admin.saved'));
      } else {
        await create.mutateAsync(values);
        message.success(t('admin.created'));
      }
      onClose();
    } catch (err) {
      message.error(err instanceof ApiError ? translateError(t, err.code, err.status) : String(err));
    }
  };

  return (
    <Modal
      open={open}
      title={isEdit ? t('admin.edit') : t('admin.create')}
      okText={t('admin.save')}
      cancelText={t('admin.cancel')}
      onOk={submit}
      onCancel={onClose}
      confirmLoading={create.isPending || update.isPending}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="name"
          label={t('auth.name')}
          rules={[
            { required: true, whitespace: true, message: t('auth.nameRequired') },
            {
              validator: (_, v?: string) =>
                !v?.trim() || LATIN_NAME.test(v.trim()) ? Promise.resolve() : Promise.reject(new Error(t('error.NAME_INVALID'))),
            },
          ]}
        >
          <Input placeholder={t('auth.namePlaceholder')} />
        </Form.Item>
        <Form.Item
          name="email"
          label={t('auth.email')}
          rules={[
            { required: true, message: t('auth.emailRequired') },
            { type: 'email', message: t('error.EMAIL_INVALID') },
          ]}
        >
          <Input type="email" />
        </Form.Item>
        <Form.Item
          name="phone"
          label={t('auth.phone')}
          rules={[
            { required: true, whitespace: true, message: t('auth.phoneRequired') },
            { pattern: PHONE, message: t('error.PHONE_INVALID') },
          ]}
        >
          <Input type="tel" placeholder={t('auth.phonePlaceholder')} />
        </Form.Item>
        <Form.Item
          name="password"
          label={isEdit ? t('admin.newPassword') : t('auth.password')}
          extra={isEdit ? t('admin.newPasswordHint') : t('auth.passwordHint')}
          rules={[
            ...(isEdit ? [] : [{ required: true, message: t('auth.passwordRequired') }]),
            { min: 8, message: t('error.PASSWORD_TOO_SHORT') },
          ]}
        >
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        {isEdit && (
          <Form.Item name="analysisPaused" label={t('admin.paused')} valuePropName="checked">
            <Switch />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}
