import createNextIntlPlugin from 'next-intl/plugin'
import type { NextConfig } from 'next'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  // Dev-only CORS so the Expo *web* build (served from a different origin,
  // e.g. http://localhost:8090) can call the API. Native iOS/Android has no
  // CORS, so this is purely for browser-based local testing. Disabled in
  // production. Override the allowed origin with MOBILE_WEB_ORIGIN.
  async headers() {
    if (process.env.NODE_ENV === 'production') return []
    const origin = process.env.MOBILE_WEB_ORIGIN ?? 'http://localhost:8090'
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: origin },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
          { key: 'Access-Control-Max-Age', value: '86400' },
          { key: 'Vary', value: 'Origin' },
        ],
      },
    ]
  },
}

export default withNextIntl(nextConfig)
