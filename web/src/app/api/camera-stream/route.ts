type RuntimeEnv = {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const runtimeEnv = (globalThis as typeof globalThis & RuntimeEnv).process?.env;
const RASPI_BASE_URL = runtimeEnv?.NEXT_PUBLIC_RASPI_BASE_URL || 'http://localhost:5000';

export const dynamic = 'force-dynamic';

export async function GET() {
  const upstreamUrl = `${RASPI_BASE_URL}/stream`;

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
