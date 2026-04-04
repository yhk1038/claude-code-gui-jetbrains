interface Props {
  envApiKeys: string[];
}

export const AuthDiagnosisBanner = (props: Props) => {
  const { envApiKeys } = props;

  return (
    <div className="mx-4 mt-1 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
      <p className="font-medium mb-1">
        ~/.claude/settings.json의 env에 API 키가 설정되어 있습니다:
      </p>
      <ul className="list-disc list-inside mb-1.5">
        {envApiKeys.map(key => (
          <li key={key}><code className="bg-amber-500/10 px-1 rounded">{key}</code></li>
        ))}
      </ul>
      <p className="text-amber-400/80">
        이 키가 만료되었거나 유효하지 않을 수 있습니다. 확인 후 제거하거나 갱신해 주세요.
      </p>
    </div>
  );
};
