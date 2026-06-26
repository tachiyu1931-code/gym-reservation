import { NextResponse } from 'next/server';
import {
  TRANSLATIONS,
  isSupportedLanguage,
} from '@/lib/translations';

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
