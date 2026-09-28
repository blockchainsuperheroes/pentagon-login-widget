# Pentagon Games Identity Standard — the login pill

**Status: required for every Pentagon front-end.** This supersedes every
hand-rolled login form, every "sign in with wallet" button, and the older
guidance in this repo and in `pg-identity-docs` that told you to build your own
form. If something you maintain has its own Pentagon login, it is out of date.

One component gives a site: **Pentagon sign-in, the user's Points, and
optionally a connected web3 wallet.** You do not implement any of it.

```html
<div data-pc-connector></div>
<script src="https://pentagon.games/connector/pc-connector.js"
        data-client-id="YOUR_CLIENT_ID" defer></script>
```

On `pentagon.games` omit `data-client-id`. Everywhere else it is required, and
your **exact** origin must be registered first (scheme + host; `www` and every
subdomain are separate). Ask nftprof.

---

## Why a pill and not a login button

**Because a login button alone leaves the user unable to see what they own.**

- MetaMask will not show `$PC` on Pentagon Chain unless the user has manually
  added chain 3344 as a custom network. Almost nobody has.
- No wallet can ever show **Points**. Points are an account balance, not a
  token — there is nothing for a wallet to display.

So a user connects MetaMask, sees nothing, and concludes they hold nothing.
Showing balances is therefore **not a nice-to-have in this design — it is the
reason the component exists.** A site that takes the login and drops the
balances has reimplemented the problem.

---

## Normative requirements

1. **MUST use the pill for Pentagon sign-in.** No site may collect a Pentagon
   password on its own origin. Passwords are typed on `pentagon.games` only.
2. **MUST display the pill's content** — balances included. You **MAY**
   re-theme it (the pill inherits your CSS custom properties). You **MUST NOT**
   take the login and discard the balance display.
3. **MUST NOT redirect users to the wallet app to log in.** Sign-in is a popup
   over your page. If the popup is blocked, re-prompt from a button; never
   fall back to navigating away.
4. **MUST re-validate server-side** before granting anything that matters.
   Pass the token to your backend, call `GET /user/info`, and build your
   session from that response — not from what the popup reported.
5. **MUST NOT pass a Pentagon login token to another origin.**
6. **SHOULD call the identity API from your server, not the browser.** Being
   registered for sign-in does **not** put your origin in the API's CORS
   allowlist — they are separate lists and they differ. A server-side read also
   means your page shows a balance it cannot forge.

### The one exception: native and in-app surfaces

A popup is wrong inside a native app or a webview, and a user already signed
into the host app must not be asked again. Those surfaces take a **session
handoff from the host app** (postMessage / an injected global), not the pill.
`ar.etherfantasy.com` is the current example. If you are unsure which you are,
ask before building.

---

## The account model this standard assumes

| | What it is | Shown as |
|---|---|---|
| **Pentagon account** | The identity. Works with no wallet at all. | Sign-in, Points |
| **Points (PG Balance)** | Custodial, non-transferable, spend-only in-ecosystem. Bought, not earned. | A balance in the pill |
| **Connected web3 wallet** | The user's own, optional | `$PC` on Pentagon Chain and on Ethereum |
| **PGAI wallet** | Self-custody, for users who have no wallet. **Pentagon Chain 3344 only.** | Same as any connected wallet |

**The account is the baseline; a web3 wallet is optional.** A user with no
wallet must be able to sign in, see their Points, and spend them. Sites that
require a wallet connection to do anything have the model backwards.

---

## Two entry orders, both required

**Sign in first, then connect a wallet.** After connecting, the pill checks the
wallet against the account's own addresses (`mm_address`, `penai_address`).
If it is neither, the pill **flags it and carries on** — this is not an error.
Web3 functions still work (mining can be paid from any wallet); the pill simply
must not imply that wallet belongs to the account, and Points stay with the
account regardless.

**Connect a wallet first, then find its account.** The wallet signs Pentagon's
message and identity returns the account that owns that address. If no account
exists, the pill offers to create one and connect it. This **is** the old "sign
in with wallet", with one fewer click — the user connects, and sign-in follows.

There is deliberately **no address→account lookup**. The signature is what
proves control, so you can only learn a wallet has a Pentagon account if you
own that wallet. An open lookup would let anyone link wallets to Pentagon
membership.

---

## Roaming ("approve in my Pentagon AI app")

Offered **only when the backend says the account has a Pentagon AI wallet**
(`user/penai/history`). A wallet on a phone or in Telegram is invisible to
EIP-6963 — the browser genuinely cannot detect it — so this cannot be guessed.
It fails closed: on any error the option is hidden rather than dead-ending
someone who never installed one.

**Roaming sign-in works today. Roaming *signing* — approving a transaction on
your phone from a third-party page — does not exist yet and is deferred.**
It is securely buildable; see `PILL-AND-WALLETS.md` in the website repo for the
conditions. Do not design a flow that depends on it.

---

## Migrating an existing login

1. Ask nftprof to register your exact origin; you get a client id.
2. Add the two lines at the top of this document.
3. Point your existing login click at the pill. Keep your own form only as a
   popup-blocked fallback.
4. Re-validate the token server-side, then create your session as you do today.
5. Delete your captcha, email-verification and password-reset code. The pill
   covers password login (email / username / PNS name), approve-from-your-app,
   email-only sign-up, forgot password, and the first-login set-password step.
6. Leave wallet-signature login and your web3 connect flow alone if you have
   them — those are a separate axis.

---

## Open question: should the agent live in the pill?

**Recommendation: no — keep it in the wallet, with at most one entry point in
the pill.**

The pill ships on every page of every Pentagon site. It must stay small,
read-only, and safe to embed anywhere; it never asks for a signature and never
moves anything, and that property is what makes it uncontroversial to drop into
a partner's nav. An agent is the opposite: stateful, conversational, and able
to take actions, which needs the wallet's trust context and per-request
approval. Putting it in the pill would put an acting surface on every partner
page and grow a component whose whole value is that it is small.

If the agent should be reachable from anywhere, the right shape is a single
button in the pill that opens it in the wallet — not the agent itself.

This is a recommendation, not a decision. nftprof's call.
