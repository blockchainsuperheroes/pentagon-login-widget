# Pentagon Login Widget

Reference implementation for integrating Pentagon Games authentication into your app.

> ## Start here: [Sign in with Pentagon](SIGN-IN-WITH-PENTAGON.md)
>
> One script, on any approved site. Your users sign in without leaving your page and you
> get a token you can use straight away — no password handling, captcha, sign-up,
> password reset or app-approval flow to build yourself.
>
> ```html
> <script src="https://pentagon.games/pgai/web-local-app/pg-signin.js"
>         data-client-id="YOUR_CLIENT_ID"></script>
> ```
>
> The rest of this README is the hand-rolled alternative. It still works, and it is the
> right choice if you need full control of the form (or you're server-side / CLI).

**Do NOT redirect users to pentagon.games/sign-in.** Build your login form inside your app and call the Pentagon Identity API directly.

## Sign-In Methods

Pentagon Identity supports 4 sign-in methods, all through the same `POST /user/login` endpoint:

| Method | `type` field | Identifier |
|--------|-------------|------------|
| Email + Password | `"email"` | `username: "user@example.com"` |
| PNS Name + Password | `"email"` | `username: "nftprof"` (lowercase on-chain name) |
| Current Username + Password | `"email"` | `username: "nftprof1"` |
| Wallet Signature | `"wallet"` | `address` + `signature` + `message` |

Additional methods via separate endpoints:
- **Magic Link** (passwordless): `POST /user/login/email`
- **Ethermail SSO**: `POST /user/login/ethermail`

## Quick Start

### 1. Get an App Key

Contact Pentagon Games team to register your app and receive a `pk_live_*` key. Include `X-PG-App-Key` header on all login/signup requests.

### 2. Choose Your Integration

- **React/Next.js**: Use `PentagonLoginModal.tsx` (see `react/`)
- **Vanilla JS**: Use `showPentagonLogin()` (see `vanilla/`)
- **Server-side / CLI**: Use the API directly (see `api-only/`)

### 3. API Base URL

```
https://api.account.pentagon.games
```

All login endpoints require the `X-PG-App-Key` header.

## Integration Patterns

Choose the pattern that fits your app:

### Pattern 1: PG Login + Wallet Match (Strict Identity)
User logs in via PG Identity, then connects their browser wallet. App verifies the connected wallet matches the wallet registered to their PG account.

**Used by:** PenDeFi, Pentagon Website staking

### Pattern 2: PG Login + Any Wallet (Flexible)
User logs in via PG Identity for NFT data, but can connect any wallet for operations. Protects users from exposing high-value wallets.

**Used by:** NFT Mining (mining.pentagon.games)

### Pattern 3: PG Login Only (No Wallet)
Pure PG Identity login. Backend handles all chain interactions using the user's managed wallet + NPC points as gas.

**Used by:** pentagon.games profile, social features, NPC points system

### Pattern 4: Wallet-First (PG Account Check)
User connects wallet first (RainbowKit). App silently checks if wallet belongs to a PG account and auto-logs in.

**Used by:** Gunnies.io, NFT purchase pages

### Pattern 5: Wallet-First + PG Optional (Zero Friction)
User connects wallet, NFTs loaded directly by address. No PG account needed. PG login is an optional enhancement.

**Used by:** NFT Mining v2 (web3 mode)

## API Reference

### Login (Email/Password/PNS)

```bash
curl -X POST https://api.account.pentagon.games/user/login \
  -H "Content-Type: application/json" \
  -H "X-PG-App-Key: pk_live_your_key" \
  -d '{
    "type": "email",
    "username": "user@example.com",
    "password": "password",
    "login_from": "your_app"
  }'
```

### Login (Wallet Signature)

```bash
curl -X POST https://api.account.pentagon.games/user/login \
  -H "Content-Type: application/json" \
  -H "X-PG-App-Key: pk_live_your_key" \
  -d '{
    "type": "wallet",
    "address": "0x1234...abcd",
    "signature": "0xsigned...",
    "message": "Logging into Pentagon Games,1745812345",
    "login_from": "your_app"
  }'
```

Message format: `Logging into Pentagon Games,{unix_timestamp_seconds}` (within 5 min of server time).

### Login (Magic Link)

```bash
curl -X POST https://api.account.pentagon.games/user/login/email \
  -H "Content-Type: application/json" \
  -H "X-PG-App-Key: pk_live_your_key" \
  -d '{"email": "user@example.com"}'
```

### Success Response

```json
{
  "status": true,
  "result": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```

### Get User Info (after login)

```bash
curl https://api.account.pentagon.games/user/info \
  -H "Authorization: Bearer <access_token>"
```

### Get User's NFTs

```bash
curl https://api.account.pentagon.games/user/nfts \
  -H "Authorization: Bearer <access_token>"
```

## Full Documentation

[Pentagon Identity API Docs](https://blockchainsuperheroes.github.io/pg-identity-docs/)

## License

MIT
