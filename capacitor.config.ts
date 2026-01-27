import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pillaxia.app',
  appName: 'Pillaxia',
  webDir: 'dist',
  server: {
    url: 'https://8333c041-bf59-48ac-a717-3597c3a11358.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#8B5CF6',
      showSpinner: false
    }
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;
