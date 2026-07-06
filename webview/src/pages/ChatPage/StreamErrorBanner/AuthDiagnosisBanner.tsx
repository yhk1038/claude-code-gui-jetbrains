import { useTranslation } from '@/i18n';

interface Props {
  envApiKeys: string[];
}

export const AuthDiagnosisBanner = (props: Props) => {
  const { envApiKeys } = props;
  const { t } = useTranslation('chat');

  return (
    <div className="mx-4 mt-1 px-3 py-2 rounded-md bg-state-pending-fg/10 border border-state-pending-border text-state-pending-fg text-xs">
      <p className="font-medium mb-1">
        {t('streamError.authDiagnosis.title')}
      </p>
      <ul className="list-disc list-inside mb-1.5">
        {envApiKeys.map(key => (
          <li key={key}><code className="bg-state-pending-fg/10 px-1 rounded">{key}</code></li>
        ))}
      </ul>
      <p className="text-state-pending-fg/80">
        {t('streamError.authDiagnosis.hint')}
      </p>
    </div>
  );
};
