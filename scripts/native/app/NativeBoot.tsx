'use client';
import { setupNativeBundle } from '@/lib/native-bundle';

// as soon as the app's code loads: API calls to the website, non-bundled links to the in-app browser
setupNativeBundle();

export function NativeBoot() {
  return null;
}
