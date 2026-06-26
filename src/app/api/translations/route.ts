import { NextResponse } from 'next/server';
import {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  type SupportedLanguage,
} from '@/lib/translations';

function isSupportedLanguage(value: string | null): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(value as SupportedLanguage);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang');

  if (!isSupportedLanguage(lang)) {
    return NextResponse.json(
      { error: 'Unsupported language' },
      { status: 400 }
    );
  }

  return NextResponse.json({
    lang,
    messages: TRANSLATIONS[lang],
  });
}
