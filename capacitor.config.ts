import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.f976e3b6c56e481485f8240003ca6ffe',
  appName: 'cammeasure-pro',
  webDir: 'dist',
  server: {
    // Comenta o elimina la URL remota para usar el servidor local
    // url: 'https://f976e3b6-c56e-4814-85f8-240003ca6ffe.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
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
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT'
    }
  },
};

export default config;
