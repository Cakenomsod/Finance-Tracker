import { NextRequest, NextResponse } from 'next/server';
import {
  countryToCurrency,
  countryToLocale,
  parseAcceptLanguage,
} from '@/lib/locale';

async function detectCountryFromIp(): Promise<string | null> {
  try {
    const res = await fetch('https://ipapi.co/country_code/', {
      headers: { 'User-Agent': 'FinanceTracker/1.0' },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const code = (await res.text()).trim();
    return code.length === 2 ? code : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const vercelCountry = request.headers.get('x-vercel-ip-country');

  const acceptLanguage = parseAcceptLanguage(request.headers.get('accept-language'));

  let country = vercelCountry;
  if (!country) {
    country = await detectCountryFromIp();
  }

  const locale = country ? countryToLocale(country) : (acceptLanguage ?? 'en');
  const currency = country ? countryToCurrency(country) : 'THB';

  return NextResponse.json({
    country,
    locale,
    currency,
    source: vercelCountry ? 'vercel' : country ? 'ipapi' : acceptLanguage ? 'accept-language' : 'default',
  });
}
