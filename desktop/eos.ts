// Epic Online Services (session 7B): the few calls of Epic's C SDK the desktop app makes, through
// koffi (a library for calling C from Node without compiling anything). The SDK's library
// (EOSSDK-Win64-Shipping.dll on Windows) comes with the SDK from Epic's Developer Portal and is
// placed beside the app when the Epic build is made; it is not in the repository. Each struct
// below follows the SDK's headers at the API version named with it. Epic keeps older API
// versions working in newer SDKs, so a newer library still takes these.

import { createRequire } from 'node:module';
import type * as KoffiModule from 'koffi';

type Koffi = typeof KoffiModule;
type TypeObject = KoffiModule.TypeObject;

/** An EOS handle or user id: an address the SDK handed out, which only the SDK reads. */
export type EosHandle = bigint;

/** The EOS_EResult codes the app tells apart; any other is a failure, named by resultName. */
export const EOS_RESULT = {
  Success: 0,
  InvalidUser: 3,
  AlreadyConfigured: 15,
  NotFound: 18,
  /** A callback with this code comes again later with the real result. */
  OperationWillRetry: 19,
} as const;

/** The API version of each options struct, as the SDK's headers call it. */
const API = {
  initialize: 5,
  platformOptions: 15,
  authCredentials: 4,
  authLogin: 3,
  authCopyIdToken: 1,
  connectCredentials: 1,
  connectLogin: 2,
  connectCreateUser: 1,
  unlockAchievements: 1,
  createPresenceModification: 1,
  setStatus: 1,
  setRawRichText: 1,
  setPresence: 1,
} as const;

const LOGIN_CREDENTIAL = { exchangeCode: 1, developer: 4 } as const;
/** EOS_EAuthScopeFlags: the player's name, and their presence for friends to see. */
const SCOPE_BASIC_PROFILE = 1;
const SCOPE_PRESENCE = 4;
/** EOS_ECT_EPIC_ID_TOKEN: the Connect interface signs in with the Epic account's ID token. */
const EXTERNAL_EPIC_ID_TOKEN = 16;
const PRESENCE_ONLINE = 1;
/** EOS_PF_DISABLE_OVERLAY. */
const FLAG_DISABLE_OVERLAY = 2;
/** EOS_PRESENCE_RICH_TEXT_MAX_VALUE_LENGTH. */
export const RICH_TEXT_MAX = 255;

/** The SDK library's file name on each platform Epic's SDK supports. */
export const SDK_LIBRARY: Readonly<Record<string, string>> = {
  win32: 'EOSSDK-Win64-Shipping.dll',
  linux: 'libEOSSDK-Linux-Shipping.so',
  darwin: 'libEOSSDK-Mac-Shipping.dylib',
};

export interface EosPlatformOptions {
  productId: string;
  sandboxId: string;
  deploymentId: string;
  clientId: string;
  clientSecret: string;
  /** A folder the SDK may keep temporary files in. */
  cacheDirectory: string;
  /** Epic's overlay (friends, achievement toasts); off when the launch asks for it. */
  overlay: boolean;
}

/** How the player signs in: the code the Epic Games Launcher passes, or Epic's Developer Authentication Tool. */
export type EosCredentials = { kind: 'exchangeCode'; code: string } | { kind: 'developer'; host: string; name: string };

/** The calls the app makes, each a thin wrapper over the SDK function of the same name. */
export interface EosSdk {
  initialize(productName: string, productVersion: string): number;
  createPlatform(options: EosPlatformOptions): EosHandle | null;
  tick(platform: EosHandle): void;
  releasePlatform(platform: EosHandle): void;
  shutdown(): void;
  /** Signs in to the player's Epic account; `done` gets their Epic account id. */
  authLogin(platform: EosHandle, credentials: EosCredentials, done: (result: number, account: EosHandle | null) => void): void;
  /** The account's ID token (a JSON Web Token), for the Connect interface. */
  copyIdToken(platform: EosHandle, account: EosHandle): string | null;
  /** Signs in to the game's services; `done` gets the product user id, or a token to create one. */
  connectLogin(
    platform: EosHandle,
    idToken: string,
    done: (result: number, user: EosHandle | null, continuance: EosHandle | null) => void,
  ): void;
  createUser(platform: EosHandle, continuance: EosHandle, done: (result: number, user: EosHandle | null) => void): void;
  unlockAchievements(platform: EosHandle, user: EosHandle, ids: readonly string[], done: (result: number) => void): void;
  /** Shows the text as the player's presence; returns a result at once if it can't start. */
  setPresence(platform: EosHandle, account: EosHandle, richText: string, done: (result: number) => void): number;
  resultName(result: number): string;
}

/** The structs, by their names in the SDK. */
export function eosTypes(koffi: Koffi) {
  const ptr = 'void *';
  const str = 'const char *';
  const InitializeOptions = koffi.struct('EOS_InitializeOptions', {
    ApiVersion: 'int32_t',
    AllocateMemoryFunction: ptr,
    ReallocateMemoryFunction: ptr,
    ReleaseMemoryFunction: ptr,
    ProductName: str,
    ProductVersion: str,
    Reserved: ptr,
    SystemInitializeOptions: ptr,
    OverrideThreadAffinity: ptr,
  });
  const ClientCredentials = koffi.struct('EOS_Platform_ClientCredentials', { ClientId: str, ClientSecret: str });
  const PlatformOptions = koffi.struct('EOS_Platform_Options', {
    ApiVersion: 'int32_t',
    Reserved: ptr,
    ProductId: str,
    SandboxId: str,
    ClientCredentials,
    bIsServer: 'int32_t',
    EncryptionKey: str,
    OverrideCountryCode: str,
    OverrideLocaleCode: str,
    DeploymentId: str,
    Flags: 'uint64_t',
    CacheDirectory: str,
    TickBudgetInMilliseconds: 'uint32_t',
    RTCOptions: ptr,
    IntegratedPlatformOptionsContainerHandle: ptr,
    SystemSpecificOptions: ptr,
    TaskNetworkTimeoutSeconds: ptr,
  });
  const AuthCredentials = koffi.struct('EOS_Auth_Credentials', {
    ApiVersion: 'int32_t',
    Id: str,
    Token: str,
    Type: 'int32_t',
    SystemAuthCredentialsOptions: ptr,
    ExternalType: 'int32_t',
  });
  const AuthLoginOptions = koffi.struct('EOS_Auth_LoginOptions', {
    ApiVersion: 'int32_t',
    Credentials: koffi.pointer(AuthCredentials),
    ScopeFlags: 'int32_t',
    LoginFlags: 'uint64_t',
  });
  const AuthLoginCallbackInfo = koffi.struct('EOS_Auth_LoginCallbackInfo', {
    ResultCode: 'int32_t',
    ClientData: ptr,
    LocalUserId: ptr,
    PinGrantInfo: ptr,
    ContinuanceToken: ptr,
    AccountFeatureRestrictedInfo_DEPRECATED: ptr,
    SelectedAccountId: ptr,
  });
  const AuthCopyIdTokenOptions = koffi.struct('EOS_Auth_CopyIdTokenOptions', { ApiVersion: 'int32_t', AccountId: ptr });
  const AuthIdToken = koffi.struct('EOS_Auth_IdToken', { ApiVersion: 'int32_t', AccountId: ptr, JsonWebToken: str });
  const ConnectCredentials = koffi.struct('EOS_Connect_Credentials', { ApiVersion: 'int32_t', Token: str, Type: 'int32_t' });
  const ConnectLoginOptions = koffi.struct('EOS_Connect_LoginOptions', {
    ApiVersion: 'int32_t',
    Credentials: koffi.pointer(ConnectCredentials),
    UserLoginInfo: ptr,
  });
  const ConnectLoginCallbackInfo = koffi.struct('EOS_Connect_LoginCallbackInfo', {
    ResultCode: 'int32_t',
    ClientData: ptr,
    LocalUserId: ptr,
    ContinuanceToken: ptr,
  });
  const ConnectCreateUserOptions = koffi.struct('EOS_Connect_CreateUserOptions', { ApiVersion: 'int32_t', ContinuanceToken: ptr });
  const ConnectCreateUserCallbackInfo = koffi.struct('EOS_Connect_CreateUserCallbackInfo', {
    ResultCode: 'int32_t',
    ClientData: ptr,
    LocalUserId: ptr,
  });
  const UnlockAchievementsOptions = koffi.struct('EOS_Achievements_UnlockAchievementsOptions', {
    ApiVersion: 'int32_t',
    UserId: ptr,
    AchievementIds: 'const char **',
    AchievementsCount: 'uint32_t',
  });
  const UnlockAchievementsCallbackInfo = koffi.struct('EOS_Achievements_OnUnlockAchievementsCompleteCallbackInfo', {
    ResultCode: 'int32_t',
    ClientData: ptr,
    UserId: ptr,
    AchievementsCount: 'uint32_t',
  });
  const CreatePresenceModificationOptions = koffi.struct('EOS_Presence_CreatePresenceModificationOptions', {
    ApiVersion: 'int32_t',
    LocalUserId: ptr,
  });
  const SetStatusOptions = koffi.struct('EOS_PresenceModification_SetStatusOptions', { ApiVersion: 'int32_t', Status: 'int32_t' });
  const SetRawRichTextOptions = koffi.struct('EOS_PresenceModification_SetRawRichTextOptions', { ApiVersion: 'int32_t', RichText: str });
  const SetPresenceOptions = koffi.struct('EOS_Presence_SetPresenceOptions', {
    ApiVersion: 'int32_t',
    LocalUserId: ptr,
    PresenceModificationHandle: ptr,
  });
  const SetPresenceCallbackInfo = koffi.struct('EOS_Presence_SetPresenceCallbackInfo', {
    ResultCode: 'int32_t',
    ClientData: ptr,
    LocalUserId: ptr,
    RichPresenceResultCode: 'int32_t',
  });
  return {
    InitializeOptions,
    ClientCredentials,
    PlatformOptions,
    AuthCredentials,
    AuthLoginOptions,
    AuthLoginCallbackInfo,
    AuthCopyIdTokenOptions,
    AuthIdToken,
    ConnectCredentials,
    ConnectLoginOptions,
    ConnectLoginCallbackInfo,
    ConnectCreateUserOptions,
    ConnectCreateUserCallbackInfo,
    UnlockAchievementsOptions,
    UnlockAchievementsCallbackInfo,
    CreatePresenceModificationOptions,
    SetStatusOptions,
    SetRawRichTextOptions,
    SetPresenceOptions,
    SetPresenceCallbackInfo,
  };
}

export type EosTypes = ReturnType<typeof eosTypes>;

let koffiTypes: { koffi: Koffi; types: EosTypes } | null = null;

/** koffi and the structs, made once: koffi keeps type names for the whole process. */
export function loadKoffi(): { koffi: Koffi; types: EosTypes } {
  if (!koffiTypes) {
    const koffi = createRequire(import.meta.url)('koffi') as Koffi;
    koffiTypes = { koffi, types: eosTypes(koffi) };
  }
  return koffiTypes;
}

/** What a callback's info struct starts with. */
interface CallbackInfo {
  ResultCode: number;
  ClientData: bigint | null;
}

/**
 * Loads the SDK library at `file`. Throws when koffi or the library can't load, or the library
 * lacks a function the app calls.
 */
export function loadEos(file: string): EosSdk {
  const { koffi, types: t } = loadKoffi();
  const lib = koffi.load(file);
  const fn = (result: string, name: string, args: string[]) => lib.func(name, result, args);
  const EOS_Initialize = fn('int32_t', 'EOS_Initialize', ['EOS_InitializeOptions *']);
  const EOS_Shutdown = fn('int32_t', 'EOS_Shutdown', []);
  const EOS_Platform_Create = fn('void *', 'EOS_Platform_Create', ['EOS_Platform_Options *']);
  const EOS_Platform_Release = fn('void', 'EOS_Platform_Release', ['void *']);
  const EOS_Platform_Tick = fn('void', 'EOS_Platform_Tick', ['void *']);
  const EOS_Platform_GetAuthInterface = fn('void *', 'EOS_Platform_GetAuthInterface', ['void *']);
  const EOS_Platform_GetConnectInterface = fn('void *', 'EOS_Platform_GetConnectInterface', ['void *']);
  const EOS_Platform_GetAchievementsInterface = fn('void *', 'EOS_Platform_GetAchievementsInterface', ['void *']);
  const EOS_Platform_GetPresenceInterface = fn('void *', 'EOS_Platform_GetPresenceInterface', ['void *']);
  const EOS_EResult_ToString = fn('const char *', 'EOS_EResult_ToString', ['int32_t']);

  // One C callback for each kind of call, kept for the life of the app. Each call passes a number
  // as its ClientData, and the SDK hands it back with the result.
  const waiting = new Map<bigint, (info: never) => void>();
  let nextCall = 1n;
  const callback = (proto: string, infoType: TypeObject) => {
    const type = koffi.pointer(koffi.proto(`void ${proto}(const ${infoType.name} *Data)`));
    const pointer = koffi.register((data: bigint) => {
      const info = koffi.decode(data, infoType) as CallbackInfo;
      if (info.ResultCode === EOS_RESULT.OperationWillRetry || info.ClientData === null) return;
      const handler = waiting.get(info.ClientData);
      waiting.delete(info.ClientData);
      handler?.(info as never);
    }, type);
    return { type, pointer };
  };
  const call = <T>(handler: (info: T) => void): bigint => {
    const id = nextCall++;
    waiting.set(id, handler as (info: never) => void);
    return id;
  };

  const onLogin = callback('EOS_Auth_OnLoginCallback', t.AuthLoginCallbackInfo);
  const onConnectLogin = callback('EOS_Connect_OnLoginCallback', t.ConnectLoginCallbackInfo);
  const onCreateUser = callback('EOS_Connect_OnCreateUserCallback', t.ConnectCreateUserCallbackInfo);
  const onUnlock = callback('EOS_Achievements_OnUnlockAchievementsCompleteCallback', t.UnlockAchievementsCallbackInfo);
  const onPresence = callback('EOS_Presence_SetPresenceCompleteCallback', t.SetPresenceCallbackInfo);

  const EOS_Auth_Login = lib.func('EOS_Auth_Login', 'void', ['void *', 'EOS_Auth_LoginOptions *', 'void *', onLogin.type]);
  const EOS_Auth_CopyIdToken = fn('int32_t', 'EOS_Auth_CopyIdToken', ['void *', 'EOS_Auth_CopyIdTokenOptions *', '_Out_ void **']);
  const EOS_Auth_IdToken_Release = fn('void', 'EOS_Auth_IdToken_Release', ['void *']);
  const EOS_Connect_Login = lib.func('EOS_Connect_Login', 'void', ['void *', 'EOS_Connect_LoginOptions *', 'void *', onConnectLogin.type]);
  const EOS_Connect_CreateUser = lib.func('EOS_Connect_CreateUser', 'void', [
    'void *',
    'EOS_Connect_CreateUserOptions *',
    'void *',
    onCreateUser.type,
  ]);
  const EOS_Achievements_UnlockAchievements = lib.func('EOS_Achievements_UnlockAchievements', 'void', [
    'void *',
    'EOS_Achievements_UnlockAchievementsOptions *',
    'void *',
    onUnlock.type,
  ]);
  const EOS_Presence_CreatePresenceModification = fn('int32_t', 'EOS_Presence_CreatePresenceModification', [
    'void *',
    'EOS_Presence_CreatePresenceModificationOptions *',
    '_Out_ void **',
  ]);
  const EOS_PresenceModification_SetStatus = fn('int32_t', 'EOS_PresenceModification_SetStatus', [
    'void *',
    'EOS_PresenceModification_SetStatusOptions *',
  ]);
  const EOS_PresenceModification_SetRawRichText = fn('int32_t', 'EOS_PresenceModification_SetRawRichText', [
    'void *',
    'EOS_PresenceModification_SetRawRichTextOptions *',
  ]);
  const EOS_PresenceModification_Release = fn('void', 'EOS_PresenceModification_Release', ['void *']);
  const EOS_Presence_SetPresence = lib.func('EOS_Presence_SetPresence', 'void', [
    'void *',
    'EOS_Presence_SetPresenceOptions *',
    'void *',
    onPresence.type,
  ]);

  return {
    initialize: (productName, productVersion) =>
      EOS_Initialize({
        ApiVersion: API.initialize,
        AllocateMemoryFunction: null,
        ReallocateMemoryFunction: null,
        ReleaseMemoryFunction: null,
        ProductName: productName,
        ProductVersion: productVersion,
        Reserved: null,
        SystemInitializeOptions: null,
        OverrideThreadAffinity: null,
      }) as number,
    createPlatform(options) {
      const platform = EOS_Platform_Create({
        ApiVersion: API.platformOptions,
        Reserved: null,
        ProductId: options.productId,
        SandboxId: options.sandboxId,
        ClientCredentials: { ClientId: options.clientId, ClientSecret: options.clientSecret },
        bIsServer: 0,
        EncryptionKey: null,
        OverrideCountryCode: null,
        OverrideLocaleCode: null,
        DeploymentId: options.deploymentId,
        Flags: options.overlay ? 0 : FLAG_DISABLE_OVERLAY,
        CacheDirectory: options.cacheDirectory,
        TickBudgetInMilliseconds: 0,
        RTCOptions: null,
        IntegratedPlatformOptionsContainerHandle: null,
        SystemSpecificOptions: null,
        TaskNetworkTimeoutSeconds: null,
      }) as bigint | null;
      return platform || null;
    },
    tick: (platform) => void EOS_Platform_Tick(platform),
    releasePlatform: (platform) => void EOS_Platform_Release(platform),
    shutdown() {
      EOS_Shutdown();
      for (const pointer of [onLogin, onConnectLogin, onCreateUser, onUnlock, onPresence]) koffi.unregister(pointer.pointer);
      waiting.clear();
    },
    authLogin(platform, credentials, done) {
      const developer = credentials.kind === 'developer';
      EOS_Auth_Login(
        EOS_Platform_GetAuthInterface(platform),
        {
          ApiVersion: API.authLogin,
          Credentials: {
            ApiVersion: API.authCredentials,
            Id: developer ? credentials.host : null,
            Token: developer ? credentials.name : credentials.code,
            Type: developer ? LOGIN_CREDENTIAL.developer : LOGIN_CREDENTIAL.exchangeCode,
            SystemAuthCredentialsOptions: null,
            ExternalType: 0,
          },
          ScopeFlags: SCOPE_BASIC_PROFILE | SCOPE_PRESENCE,
          LoginFlags: 0,
        },
        call((info: CallbackInfo & { LocalUserId: bigint | null }) => done(info.ResultCode, info.LocalUserId)),
        onLogin.pointer,
      );
    },
    copyIdToken(platform, account) {
      const out: (bigint | null)[] = [null];
      const result = EOS_Auth_CopyIdToken(
        EOS_Platform_GetAuthInterface(platform),
        { ApiVersion: API.authCopyIdToken, AccountId: account },
        out,
      ) as number;
      const token = out[0];
      if (result !== EOS_RESULT.Success || !token) return null;
      try {
        return (koffi.decode(token, t.AuthIdToken) as { JsonWebToken: string | null }).JsonWebToken;
      } finally {
        EOS_Auth_IdToken_Release(token);
      }
    },
    connectLogin(platform, idToken, done) {
      EOS_Connect_Login(
        EOS_Platform_GetConnectInterface(platform),
        {
          ApiVersion: API.connectLogin,
          Credentials: { ApiVersion: API.connectCredentials, Token: idToken, Type: EXTERNAL_EPIC_ID_TOKEN },
          UserLoginInfo: null,
        },
        call((info: CallbackInfo & { LocalUserId: bigint | null; ContinuanceToken: bigint | null }) =>
          done(info.ResultCode, info.LocalUserId, info.ContinuanceToken),
        ),
        onConnectLogin.pointer,
      );
    },
    createUser(platform, continuance, done) {
      EOS_Connect_CreateUser(
        EOS_Platform_GetConnectInterface(platform),
        { ApiVersion: API.connectCreateUser, ContinuanceToken: continuance },
        call((info: CallbackInfo & { LocalUserId: bigint | null }) => done(info.ResultCode, info.LocalUserId)),
        onCreateUser.pointer,
      );
    },
    unlockAchievements(platform, user, ids, done) {
      EOS_Achievements_UnlockAchievements(
        EOS_Platform_GetAchievementsInterface(platform),
        { ApiVersion: API.unlockAchievements, UserId: user, AchievementIds: [...ids], AchievementsCount: ids.length },
        call((info: CallbackInfo) => done(info.ResultCode)),
        onUnlock.pointer,
      );
    },
    setPresence(platform, account, richText, done) {
      const presence = EOS_Platform_GetPresenceInterface(platform);
      const out: (bigint | null)[] = [null];
      let result = EOS_Presence_CreatePresenceModification(
        presence,
        { ApiVersion: API.createPresenceModification, LocalUserId: account },
        out,
      ) as number;
      const change = out[0];
      if (result !== EOS_RESULT.Success || !change) return result || -1;
      try {
        result = EOS_PresenceModification_SetStatus(change, { ApiVersion: API.setStatus, Status: PRESENCE_ONLINE }) as number;
        if (result === EOS_RESULT.Success) {
          result = EOS_PresenceModification_SetRawRichText(change, {
            ApiVersion: API.setRawRichText,
            RichText: richText.slice(0, RICH_TEXT_MAX),
          }) as number;
        }
        if (result === EOS_RESULT.Success) {
          EOS_Presence_SetPresence(
            presence,
            { ApiVersion: API.setPresence, LocalUserId: account, PresenceModificationHandle: change },
            call((info: CallbackInfo) => done(info.ResultCode)),
            onPresence.pointer,
          );
        }
        return result;
      } finally {
        EOS_PresenceModification_Release(change);
      }
    },
    resultName: (result) => (EOS_EResult_ToString(result) as string | null) ?? `EOS result ${result}`,
  };
}

/**
 * Why koffi won't load in this app, or null when it does and lays the SDK's structs out as the
 * headers do: the desktop smoke test checks the packaged app carries it, without the SDK.
 */
export function koffiLoadProblem(load: () => { koffi: Koffi; types: EosTypes } = loadKoffi): string | null {
  try {
    const { koffi, types } = load();
    const pointer = koffi.sizeof('void *');
    if (pointer === 8 && koffi.sizeof(types.PlatformOptions) !== 144) return 'EOS_Platform_Options is not laid out as the SDK expects';
    return null;
  } catch (error) {
    return String(error);
  }
}
