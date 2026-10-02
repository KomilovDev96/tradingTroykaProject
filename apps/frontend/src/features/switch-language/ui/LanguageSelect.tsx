import { Select } from 'antd';
import { LANGUAGE_OPTIONS, useLanguageStore, useT } from '../../../shared/i18n';

export function LanguageSelect({ style }: { style?: React.CSSProperties }) {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const t = useT();

  return (
    <Select
      aria-label={t('app.language')}
      size="small"
      value={language}
      onChange={setLanguage}
      options={LANGUAGE_OPTIONS}
      style={{ width: 120, ...style }}
      popupMatchSelectWidth={false}
    />
  );
}
