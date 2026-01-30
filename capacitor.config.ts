import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pillaxia.app',
  appName: 'Pillaxia',
  webDir: 'dist',
  // Hot-reload config (uncomment for development, comment for native testing)
  // server: {
  //   url: 'https://8333c041-bf59-48ac-a717-3597c3a11358.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
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
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scrollEnabled: true,
    allowsLinkPreview: false
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#8B5CF6',
    // SECURITY: Disable WebView debugging in production builds
    // Enable only for local development by uncommenting
    webContentsDebuggingEnabled: false,
    initialFocus: false,
    overrideUserAgent: undefined,
    appendUserAgent: undefined,
    useLegacyBridge: false
  }
};

export default config;
