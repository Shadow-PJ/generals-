// Picks the platform the game is running on. The desktop app's preload script leaves a bridge
// on the window; without it, this is the browser build.

import type { DesktopBridge } from './bridge';
import { createBrowserPlatform } from './browser';
import { createDesktopPlatform } from './desktop';
import type { Platform } from './types';

export type { ChatTurn, LoadOptions, LocalModel } from './model';
export { ORDER_MODELS, type ModelChoice } from './models';
export type { Listening, SpeechInput, SpeechProblem, SpeechResult } from './speech';
export type { Display, FileName, Files, Platform } from './types';
export { NO_STORE, type Presence, type Store, type StoreName } from './store';
export { isRelayAddress, LOCAL_RELAY, type Connection, type ConnectionEvents, type Network } from './network';
export { windowScales } from './windowSizes';

export async function createPlatform(): Promise<Platform> {
  const bridge = (window as { generalsDesktop?: DesktopBridge }).generalsDesktop;
  return bridge ? createDesktopPlatform(bridge) : createBrowserPlatform();
}
