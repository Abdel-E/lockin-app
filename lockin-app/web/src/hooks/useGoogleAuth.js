import { useCallback, useEffect, useState } from 'react';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export function useGoogleAuth() {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  // Guard: never touch window.google until a token is explicitly requested
  const [token, setToken] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lockin_google_token') || 'null') || { accessToken: null, expiresAt: null }; }
    catch { return { accessToken: null, expiresAt: null }; }
  });

  useEffect(() => {
    localStorage.setItem('lockin_google_token', JSON.stringify(token));
  }, [token]);

  const isAuthed = !!token.accessToken && !!token.expiresAt && Date.now() < token.expiresAt;

  const ensureToken = useCallback(async () => {
    if (!clientId) return null;
    if (token.accessToken && token.expiresAt && Date.now() < token.expiresAt - 60_000) return token.accessToken;

    await new Promise((resolve, reject) => {
      const google = window.google;
      if (!google || !google.accounts || !google.accounts.oauth2 || !google.accounts.oauth2.initTokenClient) {
        return reject(new Error('Google Identity Services not loaded'));
      }
      const tc = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        prompt: token.accessToken ? '' : 'consent',
        callback: (resp) => {
          if (resp?.access_token) {
            setToken({ accessToken: resp.access_token, expiresAt: Date.now() + (resp.expires_in || 3600) * 1000 });
            resolve();
          } else reject(new Error('No access token'));
        },
      });
      tc.requestAccessToken();
    });
    const saved = JSON.parse(localStorage.getItem('lockin_google_token') || '{}');
    return saved.accessToken || token.accessToken || null;
  }, [clientId, token.accessToken, token.expiresAt]);

  const signOut = useCallback(() => {
    setToken({ accessToken: null, expiresAt: null });
  }, []);

  return { hasClient: !!clientId, isAuthed, ensureToken, signOut };
}