// Picks the platform the game is running on. The desktop app's preload script leaves a bridge
// on the window; without it, this is the browser build.

import type { DesktopBridge } from './bridge';
import { createBrowserPlatform } from './browser';
import { createDesktopPlatform } from './desktop';
import type { Platform } from './types';

export type { Display, FileName, Files, Platform } from './types';
export { windowScales } from './windowSizes';

export async function createPlatform(): Promise<Platform> {
  const bridge = (window as { generalsDesktop?: DesktopBridge }).generalsDesktop;
  return bridge ? createDesktopPlatform(bridge) : createBrowserPlatform();
}
