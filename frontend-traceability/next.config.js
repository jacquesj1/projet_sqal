// 🌐 Next.js Configuration - Frontend Traçabilité V2.1
// =====================================================

/** @type {import('next').NextConfig} */

// Import conditionnel PWA
let withPWA;
try {
    withPWA = require('next-pwa')({
        dest: 'public',
        disable: process.env.NODE_ENV === 'development',
        register: true,
        skipWaiting: true,
        runtimeCaching: [
            {
                urlPattern: /^https?.*/,
                handler: 'NetworkFirst',
                options: {
                    cacheName: 'offlineCache',
                    expiration: {
                        maxEntries: 200,
                    },
                },
            },
        ],
    });
} catch (error) {
    console.warn('⚠️ next-pwa not installed, PWA features disabled');
    withPWA = (config) => config;
}

const nextConfig = {
    // Configuration de base
    reactStrictMode: true,
    swcMinify: true,
    output: 'standalone',

    // Variables d'environnement
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
        NEXT_PUBLIC_BLOCKCHAIN_API: process.env.NEXT_PUBLIC_BLOCKCHAIN_API || 'http://localhost:8000/api/v1/blockchain',
    },

    // Experimental features
    experimental: {
        optimizeCss: true,
        optimizePackageImports: ['qr-scanner'],
    },

    // Configuration images
    images: {
        domains: [
            'localhost',
            'trace.gaveurs.adeepventure.com',
            'api.gaveurs.adeepventure.com'
        ],
        formats: ['image/webp', 'image/avif'],
    },

    // Headers de sécurité pour PWA
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'X-Frame-Options',
                        value: 'DENY',
                    },
                    {
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    // PWA headers
                    {
                        key: 'Service-Worker-Allowed',
                        value: '/',
                    },
                ],
            },
            {
                source: '/sw.js',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-cache, no-store, must-revalidate',
                    },
                ],
            },
        ];
    },

    // Redirections
    async redirects() {
        return [
            {
                source: '/qr',
                destination: '/scanner',
                permanent: false,
            },
        ];
    },

    // Rewrites pour blockchain API
    async rewrites() {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

        return [
            {
                source: '/api/trace/:qrcode*',
                destination: `${apiUrl}/api/v1/blockchain/trace/:qrcode*`,
            },
            {
                source: '/api/public/:path*',
                destination: `${apiUrl}/api/v1/public/:path*`,
            },
        ];
    },

    // Configuration Webpack pour PWA
    webpack: (config, { dev, isServer }) => {
        // Configuration pour QR Scanner
        config.module.rules.push({
            test: /\.worker\.js$/,
            use: { loader: 'worker-loader' }
        });

        return config;
    },
};

module.exports = withPWA(nextConfig);