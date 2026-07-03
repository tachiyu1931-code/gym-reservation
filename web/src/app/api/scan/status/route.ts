import { NextResponse } from 'next/server';

const RASPI_BASE_URL = process.env.NEXT_PUBLIC_RASPI_BASE_URL || 'http://192.168.3.248:5000';

export async function GET() {
  try {
    const res = await fetch(`${RASPI_BASE_URL}/status`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json({ state: 'error', message: String(err) }, { status: 502 });
  }
}
