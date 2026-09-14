/**
 * OAuth adapter boundary for Google / Facebook.
 *
 * CURRENT LIMITATION (local architecture):
 * This is a development adapter only. It does NOT call real Google/Facebook OAuth,
 * does NOT validate ID tokens, and is NOT production-ready.
 * Later map to Supabase Auth providers (Google, Facebook).
 */

export type SocialProvider = "GOOGLE" | "FACEBOOK";

export type SocialProfile = {
  provider: SocialProvider;
  providerSubjectId: string;
  providerEmail: string | null;
  displayName: string | null;
};

export type OAuthAdapter = {
  /** Begin OAuth — returns a URL or mock token for the local adapter. */
  begin(provider: SocialProvider, returnTo: string): { mode: "mock"; mockToken: string; returnTo: string };
  /** Complete OAuth from a mock or future real callback payload. */
  complete(provider: SocialProvider, payload: { mockToken?: string; subjectId?: string; email?: string; displayName?: string }): SocialProfile;
};

function requireDevSocial(): void {
  if (process.env.NODE_ENV === "production" && process.env.KUBHAI_ALLOW_DEV_OAUTH !== "1") {
    throw new Error("Social login adapter is not configured for production");
  }
}

export const localOAuthAdapter: OAuthAdapter = {
  begin(provider, returnTo) {
    requireDevSocial();
    const mockToken = `dev-${provider.toLowerCase()}-${Date.now()}`;
    return { mode: "mock", mockToken, returnTo };
  },
  complete(provider, payload) {
    requireDevSocial();
    const subjectId =
      payload.subjectId ??
      (payload.mockToken ? `mock:${payload.mockToken}` : `mock:${provider}:${Date.now()}`);
    return {
      provider,
      providerSubjectId: subjectId,
      providerEmail: payload.email ?? null,
      displayName: payload.displayName ?? null,
    };
  },
};

export function getOAuthAdapter(): OAuthAdapter {
  return localOAuthAdapter;
}
