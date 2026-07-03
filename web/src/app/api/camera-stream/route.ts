const RASPI_HOST = process.env.RASPI_OCR_HOST || '192.168.3.248';
const RASPI_PORT = process.env.RASPI_OCR_PORT || '5000';

export const dynamic = 'force-dynamic';

export async function GET() {
  const upstreamUrl = `http://${RASPI_HOST}:${RASPI_PORT}/stream`;

  try {
    const upstream = await fetch(upstreamUrl, {
      cache: 'no-store',
    });

    if (!upstream.ok || !upstream.body) {
      return new Response('Raspberry Pi camera stream is unavailable.', {
        status: upstream.status || 502,
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type':
          upstream.headers.get('content-type') ||
          'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return new Response(`Could not connect to Raspberry Pi camera stream: ${message}`, {
      status: 502,
    });
  }
}
