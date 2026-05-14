import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smallcap.radar',
  appName: '공시레이더',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
};

export default config;
