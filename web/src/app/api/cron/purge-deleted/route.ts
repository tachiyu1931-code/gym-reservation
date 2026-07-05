import { NextResponse } from 'next/server';
import { purgeOldDeletedRecords } from '@/lib/purgeDeletedRecords';

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await purgeOldDeletedRecords();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Cron purge-deleted error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
