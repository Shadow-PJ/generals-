/*
 * A stand-in for Epic's SDK library (session 7B), with the few functions the desktop app calls
 * (desktop/eos.ts). eos.test.ts builds it with the computer's C compiler and calls it through the
 * real binding, so a struct laid out wrong, or a callback wired wrong, fails a test instead of
 * crashing the game. The layouts follow the SDK's headers; nothing here is Epic's code. Named
 * libEOSSDK-Linux-Shipping.so in desktop/eos, it also stands in for the SDK in the whole app.
 */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef int32_t EOS_EResult;
typedef void *Handle;

/* What the binding sent, for the test to read back. */
static char last[2048];
/* Calls waiting for the next tick, each with its callback and a copy of its result. */
#define MAX_PENDING 16
static struct { void *data; void *callback; } pending[MAX_PENDING];
static int pendingCount;

static void note(const char *text) {
  strncat(last, text, sizeof(last) - strlen(last) - 1);
  strncat(last, ";", sizeof(last) - strlen(last) - 1);
  /* For a check of the whole app: FAKE_EOS_LOG names a file that gets every line too. */
  const char *file = getenv("FAKE_EOS_LOG");
  FILE *out = file ? fopen(file, "a") : NULL;
  if (out) {
    fprintf(out, "%s\n", text);
    fclose(out);
  }
}

/* Whether a pointer was set, the same on every C library (printf's %p differs). */
static const char *set(const void *p) { return p ? "set" : "null"; }

const char *Fake_Last(void) { return last; }
void Fake_Clear(void) { last[0] = 0; }

typedef struct { int32_t ApiVersion; void *A; void *R; void *F; const char *ProductName; const char *ProductVersion; void *Reserved; void *Sys; void *Aff; } InitializeOptions;
typedef struct { const char *ClientId; const char *ClientSecret; } ClientCredentials;
typedef struct {
  int32_t ApiVersion; void *Reserved; const char *ProductId; const char *SandboxId; ClientCredentials Client;
  int32_t bIsServer; const char *EncryptionKey; const char *Country; const char *Locale; const char *DeploymentId;
  uint64_t Flags; const char *CacheDirectory; uint32_t TickBudget; void *Rtc; void *Integrated; void *SystemSpecific; double *Timeout;
} PlatformOptions;
typedef struct { int32_t ApiVersion; const char *Id; const char *Token; int32_t Type; void *Sys; int32_t ExternalType; } AuthCredentials;
typedef struct { int32_t ApiVersion; const AuthCredentials *Credentials; int32_t ScopeFlags; uint64_t LoginFlags; } AuthLoginOptions;
typedef struct { EOS_EResult ResultCode; void *ClientData; void *LocalUserId; void *Pin; void *Continuance; void *Restricted; void *Selected; } AuthLoginInfo;
typedef struct { int32_t ApiVersion; void *AccountId; } CopyIdTokenOptions;
typedef struct { int32_t ApiVersion; void *AccountId; const char *JsonWebToken; } IdToken;
typedef struct { int32_t ApiVersion; const char *Token; int32_t Type; } ConnectCredentials;
typedef struct { int32_t ApiVersion; const ConnectCredentials *Credentials; void *UserLoginInfo; } ConnectLoginOptions;
typedef struct { EOS_EResult ResultCode; void *ClientData; void *LocalUserId; void *Continuance; } ConnectLoginInfo;
typedef struct { int32_t ApiVersion; void *Continuance; } CreateUserOptions;
typedef struct { EOS_EResult ResultCode; void *ClientData; void *LocalUserId; } CreateUserInfo;
typedef struct { int32_t ApiVersion; void *UserId; const char **AchievementIds; uint32_t Count; } UnlockOptions;
typedef struct { EOS_EResult ResultCode; void *ClientData; void *UserId; uint32_t Count; } UnlockInfo;
typedef struct { int32_t ApiVersion; void *LocalUserId; } CreateModificationOptions;
typedef struct { int32_t ApiVersion; int32_t Status; } SetStatusOptions;
typedef struct { int32_t ApiVersion; const char *RichText; } SetRichTextOptions;
typedef struct { int32_t ApiVersion; void *LocalUserId; void *Modification; } SetPresenceOptions;
typedef struct { EOS_EResult ResultCode; void *ClientData; void *LocalUserId; EOS_EResult RichResult; } SetPresenceInfo;

/* Fake handles and ids: fixed addresses the SDK would own. */
static char platform, auth, connect, achievements, presence, account, user, continuance, modification;
static IdToken token = { 1, &account, "header.payload.signature" };

EOS_EResult EOS_Initialize(const InitializeOptions *o) {
  char text[256];
  snprintf(text, sizeof(text), "init %d %s %s %s", o->ApiVersion, o->ProductName, o->ProductVersion, set(o->Aff));
  note(text);
  return 0;
}
EOS_EResult EOS_Shutdown(void) { note("shutdown"); return 0; }
Handle EOS_Platform_Create(const PlatformOptions *o) {
  char text[512];
  snprintf(text, sizeof(text), "platform %d %s %s %s %s %s %d %llu %s %u %s", o->ApiVersion, o->ProductId, o->SandboxId,
           o->Client.ClientId, o->Client.ClientSecret, o->DeploymentId, o->bIsServer, (unsigned long long)o->Flags,
           o->CacheDirectory, o->TickBudget, set(o->Timeout));
  note(text);
  return &platform;
}
void EOS_Platform_Release(Handle h) { note(h == &platform ? "release" : "release ?"); }
Handle EOS_Platform_GetAuthInterface(Handle h) { return h == &platform ? &auth : NULL; }
Handle EOS_Platform_GetConnectInterface(Handle h) { return h == &platform ? &connect : NULL; }
Handle EOS_Platform_GetAchievementsInterface(Handle h) { return h == &platform ? &achievements : NULL; }
Handle EOS_Platform_GetPresenceInterface(Handle h) { return h == &platform ? &presence : NULL; }
const char *EOS_EResult_ToString(EOS_EResult r) { return r == 0 ? "EOS_Success" : r == 3 ? "EOS_InvalidUser" : "EOS_Other"; }

/* Each call's callback waits for the next tick, as the SDK's do. */
static void later(void *data, size_t size, void *callback) {
  if (pendingCount == MAX_PENDING) return;
  pending[pendingCount].data = malloc(size);
  memcpy(pending[pendingCount].data, data, size);
  pending[pendingCount].callback = callback;
  pendingCount++;
}

void EOS_Auth_Login(Handle h, const AuthLoginOptions *o, void *clientData, void (*cb)(const AuthLoginInfo *)) {
  char text[256];
  snprintf(text, sizeof(text), "login %d %d %s %s %d scopes %d flags %llu", o->ApiVersion, o->Credentials->ApiVersion,
           o->Credentials->Id ? o->Credentials->Id : "(null)", o->Credentials->Token, o->Credentials->Type, o->ScopeFlags,
           (unsigned long long)o->LoginFlags);
  note(h == &auth ? text : "login on the wrong interface");
  AuthLoginInfo info = { 0, clientData, &account, NULL, NULL, NULL, &account };
  later(&info, sizeof(info), (void *)cb);
}
EOS_EResult EOS_Auth_CopyIdToken(Handle h, const CopyIdTokenOptions *o, IdToken **out) {
  note(h == &auth && o->AccountId == &account && o->ApiVersion == 1 ? "copy token" : "copy token ?");
  *out = &token;
  return 0;
}
void EOS_Auth_IdToken_Release(IdToken *t) { note(t == &token ? "token released" : "token released ?"); }

void EOS_Connect_Login(Handle h, const ConnectLoginOptions *o, void *clientData, void (*cb)(const ConnectLoginInfo *)) {
  char text[256];
  snprintf(text, sizeof(text), "connect %d %d %s %d %s", o->ApiVersion, o->Credentials->ApiVersion, o->Credentials->Token,
           o->Credentials->Type, set(o->UserLoginInfo));
  note(h == &connect ? text : "connect on the wrong interface");
  /* A first sign-in has no product user yet: the SDK says so, with a token to create one. */
  ConnectLoginInfo info = { 3, clientData, NULL, &continuance };
  later(&info, sizeof(info), (void *)cb);
}
void EOS_Connect_CreateUser(Handle h, const CreateUserOptions *o, void *clientData, void (*cb)(const CreateUserInfo *)) {
  note(h == &connect && o->Continuance == &continuance && o->ApiVersion == 1 ? "create user" : "create user ?");
  CreateUserInfo info = { 0, clientData, &user };
  later(&info, sizeof(info), (void *)cb);
}
void EOS_Achievements_UnlockAchievements(Handle h, const UnlockOptions *o, void *clientData, void (*cb)(const UnlockInfo *)) {
  char text[512];
  snprintf(text, sizeof(text), "unlock %d %s %u:", o->ApiVersion, o->UserId == &user ? "user" : "?", o->Count);
  for (uint32_t i = 0; i < o->Count; i++) {
    strncat(text, " ", sizeof(text) - strlen(text) - 1);
    strncat(text, o->AchievementIds[i], sizeof(text) - strlen(text) - 1);
  }
  note(h == &achievements ? text : "unlock on the wrong interface");
  UnlockInfo info = { 0, clientData, &user, o->Count };
  later(&info, sizeof(info), (void *)cb);
}
EOS_EResult EOS_Presence_CreatePresenceModification(Handle h, const CreateModificationOptions *o, Handle *out) {
  note(h == &presence && o->LocalUserId == &account && o->ApiVersion == 1 ? "modify" : "modify ?");
  *out = &modification;
  return 0;
}
EOS_EResult EOS_PresenceModification_SetStatus(Handle m, const SetStatusOptions *o) {
  char text[64];
  snprintf(text, sizeof(text), "status %d %d", o->ApiVersion, o->Status);
  note(m == &modification ? text : "status ?");
  return 0;
}
EOS_EResult EOS_PresenceModification_SetRawRichText(Handle m, const SetRichTextOptions *o) {
  char text[300];
  snprintf(text, sizeof(text), "text %d %s", o->ApiVersion, o->RichText);
  note(m == &modification ? text : "text ?");
  return 0;
}
void EOS_PresenceModification_Release(Handle m) { note(m == &modification ? "modification released" : "modification released ?"); }
void EOS_Presence_SetPresence(Handle h, const SetPresenceOptions *o, void *clientData, void (*cb)(const SetPresenceInfo *)) {
  note(h == &presence && o->LocalUserId == &account && o->Modification == &modification && o->ApiVersion == 1 ? "set presence" : "set presence ?");
  SetPresenceInfo info = { 0, clientData, &account, 0 };
  later(&info, sizeof(info), (void *)cb);
}

void EOS_Platform_Tick(Handle h) {
  if (h != &platform) return;
  /* Calls made from inside a callback wait for the tick after. */
  int count = pendingCount;
  for (int i = 0; i < count; i++) {
    ((void (*)(const void *))pending[i].callback)(pending[i].data);
    free(pending[i].data);
  }
  memmove(pending, pending + count, (size_t)(pendingCount - count) * sizeof(pending[0]));
  pendingCount -= count;
}
