/**
 * api-only/login.js
 * 
 * Server-side or API-only Pentagon login examples.
 * No UI, no popup. Direct API calls for backends, CLI tools,
 * or server-rendered apps.
 * 
 * DO NOT redirect users to pentagon.games/sign-in.
 */

const PG_API = 'https://api.account.pentagon.games';

/**
 * Login with email + password (also works with PNS name or username)
 */
async function pgLoginEmail(username, password, appKey) {
  const res = await fetch(`${PG_API}/user/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PG-App-Key': appKey
    },
    body: JSON.stringify({
      type: 'email',
      username,       // email, PNS name, or PG username
      password,
      login_from: 'your_app'
    })
  });
  const data = await res.json();
  if (data.status) return data.result; // { access_token, refresh_token }
  throw new Error(data.message || 'Login failed');
}

/**
 * Login with wallet signature
 * 
 * The message must be: "Logging into Pentagon Games,{unix_timestamp_seconds}"
 * Timestamp must be within 5 minutes of server time.
 * Wallet must be previously bound to a PG account via /user/bind_metamask.
 */
async function pgLoginWallet(address, signature, message, appKey) {
  const res = await fetch(`${PG_API}/user/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PG-App-Key': appKey
    },
    body: JSON.stringify({
      type: 'wallet',
      address: address.toLowerCase(),
      signature,
      message,
      login_from: 'your_app'
    })
  });
  const data = await res.json();
  if (data.status) return data.result;
  throw new Error(data.message || 'Wallet login failed');
}

/**
 * Send magic link (passwordless login via email)
 */
async function pgMagicLink(email, appKey) {
  const res = await fetch(`${PG_API}/user/login/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-PG-App-Key': appKey
    },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (data.status) return true;
  throw new Error(data.message || 'Failed to send magic link');
}

/**
 * Get user info after login
 */
async function pgGetUser(accessToken) {
  const res = await fetch(`${PG_API}/user/info`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (data.status !== false) return data.result;
  throw new Error('Failed to get user info');
}

/**
 * Get user's NFTs
 */
async function pgGetNfts(accessToken, collection) {
  let url = `${PG_API}/user/nfts`;
  if (collection) url += `?collection=${encodeURIComponent(collection)}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const data = await res.json();
  if (data.success) return data.result;
  throw new Error('Failed to get NFTs');
}

/**
 * Refresh expired token
 */
async function pgRefreshToken(refreshToken) {
  const res = await fetch(`${PG_API}/user/token/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const data = await res.json();
  if (data.status) return data.result;
  throw new Error('Token refresh failed');
}

module.exports = {
  pgLoginEmail,
  pgLoginWallet,
  pgMagicLink,
  pgGetUser,
  pgGetNfts,
  pgRefreshToken
};
