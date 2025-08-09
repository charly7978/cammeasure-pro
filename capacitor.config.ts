import type { CapacitorConfig } from '@capacitor/core';

const config: CapacitorConfig = {
  appId: 'app.lovable.f976e3b6c56e481485f8240003ca6ffe',
  appName: 'cammeasure-pro',
  webDir: 'dist',
  server: {
    url: 'https://f976e3b6-c56e-4814-85f8-240003ca6ffe.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: ['camera', 'photos'],
    },
    Device: {
      permissions: ['device-info'],
    },
    Motion: {
      permissions: ['motion'],
    },
  },
};

export default config;