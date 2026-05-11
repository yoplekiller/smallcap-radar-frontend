import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smallcap.radar',
  appName: '소형주 공시 레이더',
  webDir: 'out',
  server: {
    androidScheme: 'https',
    url: 'https://smallcap-radar-frontend.vercel.app',
    cleartext: false,
  },
};

export default config;
