import { NusachKey } from '../types';

export interface NusachDefinition {
  key: NusachKey;
  label: string;
  bracha: string;
  harachaman: string;
}

export const NUSACH_LIBRARY: Record<NusachKey, NusachDefinition> = {
  ashkenaz: {
    key: 'ashkenaz',
    label: 'Ashkenaz',
    bracha:
      "ברוך אתה ה' אלוקינו מלך העולם אשר קדשנו במצותיו וצונו על ספירת העומר.",
    harachaman:
      'הרחמן הוא יחזיר לנו עבודת בית המקדש למקומה במהרה בימינו אמן סלה.'
  },
  sefard: {
    key: 'sefard',
    label: 'Sefard',
    bracha:
      "ברוך אתה ה' אלוקינו מלך העולם אשר קדשנו במצותיו וצונו על ספירת העומר.",
    harachaman:
      'הרחמן הוא יחזיר לנו עבודת בית המקדש למקומה במהרה בימינו אמן סלה.'
  },
  edotMizrach: {
    key: 'edotMizrach',
    label: 'Edot Mizrach',
    bracha:
      "ברוך אתה ה' אלוהינו מלך העולם אשר קדשנו במצותיו וצונו על ספירת העומר.",
    harachaman:
      'הרחמן הוא יחזיר לנו עבודת בית המקדש למקומה במהרה בימינו אמן סלה.'
  }
};

export const NUSACH_OPTIONS = Object.values(NUSACH_LIBRARY);
