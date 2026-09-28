# Sign in with Pentagon

One script. Your users sign in with their Pentagon Games account without leaving your site, and you get a token you can use straight away.

This is the recommended integration. The hand-rolled login form in this repo still works, but with this you don't handle passwords, captchas, sign-up, password resets or the Pentagon AI app approval flow yourself — and you get new sign-in methods as they ship.

```html
<script src="https://pentagon.games/pgai/web-local-app/pg-signin.js"
        data-client-id="YOUR_CLIENT_ID"></script>
```

```js
document.getElementById('login').addEventListener('click', function () {
  PGSignIn.open().then(function (r) {
    if (!r.ok) return                // r.reason: 'cancelled' | 'popup-blocked'
    startSession(r.token || r.ssoToken)
  })
})
```

Call it from a real click. Browsers block popups that aren't opened from a user action, and you'll get `{ok: false, reason: 'popup-blocked'}`.

## Getting a client id

Email nftprof@pentagon.games with your **exact site origin** (scheme + host, e.g. `https://app.example.com`) and we register it. One entry per origin: `https://example.com` and `https://www.example.com` are different, and so is every subdomain.

Until your origin is registered, the sign-in window shows "… isn't approved to use Sign in with Pentagon. Nothing was shared." and closes. Nothing leaks either way.

You still need an **App Key** (`X-PG-App-Key`) for your own API calls. Same request.

## What you get back

```js
{ ok: true, token: '<login JWT>', ssoToken: '<site-scoped token>' }
```

| | What it is | Use it for |
|---|---|---|
| `ssoToken` | Site-scoped, 24h. Every site gets this. | `POST /sso/walletinfo`, `/sso/validate`, `/sso/user_roles` |
| `token` | The login access token — the same one `POST /user/login` returns. **Pentagon's own sites only.** | `GET /user/info`, `GET /user/walletinfo`, `POST /user/aa/execute`, everything else that takes a Bearer token |

Both are also written to your own site's `localStorage` (`pg_sso_token`, `pg_token`), so a reload keeps the session. Read them with `PGSignIn.ssoToken()` / `PGSignIn.token()`.

There is no refresh token. When a call returns 401, clear it and call `PGSignIn.open()` again.

## API

| Call | Does |
|---|---|
| `PGSignIn.open(opts?)` | Overlay on pentagon.games, popup elsewhere. Returns `Promise<{ok, token?, ssoToken?, reason?}>` |
| `PGSignIn.openPopup(opts?)` | Always a popup |
| `PGSignIn.token()` | Login token on this site, or `null` |
| `PGSignIn.ssoToken()` | Site-scoped token, or `null` |
| `PGSignIn.signOut()` | Forgets both on this site |

`opts.clientId` overrides `data-client-id`.

## What the user sees

One window covering every way into a Pentagon account:

- email, username or PNS name + password
- **Approve from my Pentagon AI app** — no password: they type their account name, your page shows a 2-digit number, and they tap the matching number in the Pentagon AI app where they're already signed in (phone, Telegram, or the Chrome extension). The account's seed never moves.
- sign up (email only — we send them a link; Pentagon usernames are `user<id>` and a real name comes from a [PNS name](https://id.peg.gg))
- forgot password, and the first-login "set your password" step

## How it stays safe

Worth knowing, because it's why this is the only supported way to embed Pentagon sign-in:

- **Your origin is checked before anything is shown.** The window calls `POST /sso/authorize` with your client id and the origin that opened it. Not registered, not shown.
- **The result goes to your origin only.** It's posted with `targetOrigin` set to your exact origin, and the script checks it came from the window it opened, carrying a one-time random `state`. A page on any other origin receives nothing.
- **Popup, never an iframe on your site.** The sign-in page refuses to be framed anywhere but pentagon.games (`frame-ancestors 'self'`), so no site can wrap it in its own chrome and phish a password.
- **The sign-in window never asks for a seed phrase, a private key or a signature.** If anything claiming to be Pentagon sign-in does, it isn't ours.
- **Don't proxy or re-host the script or the sign-in page**, and don't pass the login token to another origin.

## Troubleshooting

| Symptom | Cause |
|---|---|
| `popup-blocked` | Not called from a click, or the browser blocked it. Re-prompt from a button. |
| "isn't approved…" | Origin not registered, or it doesn't match exactly (www, subdomain, http vs https). |
| `ok: true` but no `token` | Expected on third-party sites: use `ssoToken` with the `/sso/*` endpoints. |
| 401 on `/user/*` | Token expired. Clear it and sign in again. |

Questions: nftprof@pentagon.games. API reference: https://blockchainsuperheroes.github.io/pg-identity-docs/
