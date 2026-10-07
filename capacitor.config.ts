import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.siren.music',
  appName: 'SIREN',
  webDir: 'dist',
  server: {
    // Enable cleartext traffic (HTTP) for local testing & live-reload
    cleartext: true,
    androidScheme: 'https',
    // Uncomment and replace with your computer's local IP or dev URL for live reload on a physical device / emulator:
    // url: 'http://10.0.2.2:3000', // for Android Emulator
    // url: 'http://192.168.1.X:3000', // for physical phone on same Wi-Fi
  },
};

export default config;
