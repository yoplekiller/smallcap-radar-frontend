import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smallcap.radar',
  appName: '소형주 공시 레이더',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
};

export default config;
