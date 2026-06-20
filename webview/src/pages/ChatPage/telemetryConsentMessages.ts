// 텔레메트리 동의 배너 전용 경량 i18n. webview에 공용 i18n 시스템이 없어, 이 배너의
// 문구·버튼만 General 설정의 language(LANGUAGE_OPTIONS 값)에 맞춰 번역한다. 미설정 시 영어.

export interface ConsentCopy {
  /** 제목(1줄) */
  title: string;
  /** 보조 설명(뮤트, 2줄) */
  subtitle: string;
  /** 수락 버튼 */
  accept: string;
  /** 거부 버튼 */
  deny: string;
  /** 개인정보처리방침 링크 텍스트 */
  privacyPolicy: string;
}

const CONSENT_COPY: Record<string, ConsentCopy> = {
  english: {
    title: 'Allow collecting usage statistics to improve the product?',
    subtitle: 'Source code and personal data are never sent. You can turn this off anytime in settings.',
    accept: 'Allow',
    deny: 'Decline',
    privacyPolicy: 'Privacy Policy',
  },
  korean: {
    title: '제품 개선을 위한 사용 통계 수집을 허용하시겠습니까?',
    subtitle: '소스코드와 개인정보는 보내지 않으며, 설정에서 언제든 끌 수 있습니다.',
    accept: '수락',
    deny: '거부',
    privacyPolicy: '개인정보처리방침',
  },
  japanese: {
    title: '製品改善のための使用統計の収集を許可しますか？',
    subtitle: 'ソースコードや個人情報は送信されません。設定でいつでもオフにできます。',
    accept: '許可',
    deny: '拒否',
    privacyPolicy: 'プライバシーポリシー',
  },
  chinese: {
    title: '是否允许收集使用统计数据以改进产品？',
    subtitle: '绝不会发送源代码和个人信息，您可以随时在设置中关闭。',
    accept: '允许',
    deny: '拒绝',
    privacyPolicy: '隐私政策',
  },
  spanish: {
    title: '¿Permitir la recopilación de estadísticas de uso para mejorar el producto?',
    subtitle: 'Nunca se envían el código fuente ni datos personales. Puedes desactivarlo cuando quieras en los ajustes.',
    accept: 'Permitir',
    deny: 'Rechazar',
    privacyPolicy: 'Política de privacidad',
  },
  french: {
    title: "Autoriser la collecte de statistiques d'utilisation pour améliorer le produit ?",
    subtitle: "Le code source et les données personnelles ne sont jamais envoyés. Vous pouvez le désactiver à tout moment dans les paramètres.",
    accept: 'Autoriser',
    deny: 'Refuser',
    privacyPolicy: 'Politique de confidentialité',
  },
  german: {
    title: 'Erfassung von Nutzungsstatistiken zur Produktverbesserung erlauben?',
    subtitle: 'Quellcode und personenbezogene Daten werden nie gesendet. Sie können dies jederzeit in den Einstellungen deaktivieren.',
    accept: 'Erlauben',
    deny: 'Ablehnen',
    privacyPolicy: 'Datenschutzerklärung',
  },
  portuguese: {
    title: 'Permitir a coleta de estatísticas de uso para melhorar o produto?',
    subtitle: 'O código-fonte e os dados pessoais nunca são enviados. Você pode desativar isso a qualquer momento nas configurações.',
    accept: 'Permitir',
    deny: 'Recusar',
    privacyPolicy: 'Política de Privacidade',
  },
  russian: {
    title: 'Разрешить сбор статистики использования для улучшения продукта?',
    subtitle: 'Исходный код и персональные данные никогда не отправляются. Вы можете отключить это в любой момент в настройках.',
    accept: 'Разрешить',
    deny: 'Отклонить',
    privacyPolicy: 'Политика конфиденциальности',
  },
};

/** language 설정값(LANGUAGE_OPTIONS)에 맞는 동의 문구를 반환한다. 미설정/미지원이면 영어. */
export function getConsentCopy(language: string | undefined): ConsentCopy {
  if (language) {
    const copy = CONSENT_COPY[language];
    if (copy) return copy;
  }
  return CONSENT_COPY.english;
}
