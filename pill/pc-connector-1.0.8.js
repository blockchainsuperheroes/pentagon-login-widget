/* PC Connector — one wallet/gas widget for every Pentagon site.
 *
 *   <div data-pc-connector></div>   compact pill + dropdown (nav)
 *   <div data-pc-guide></div>       inline "what should I do" panel
 *   <script src="https://pentagon.games/connector/pc-connector.js" defer></script>
 *
 * Sites with their own wallet button hand it over instead of adding a second
 * one (1.0.1): PCConnector.attach(provider, account, { connect, name, icon })
 * - the pill follows the host's EIP-1193 provider, its Connect buttons call the
 * host's connect, and it shows no Disconnect of its own. detach() undoes it;
 * unmount(el) removes a mounted pill or guide.
 *
 * Detects before it asks (docs/SMART-PC-FLOW.md): a previously connected wallet
 * and, on pentagon.games, a Pentagon login are picked up silently; balances are
 * read by address from public RPCs (PC gas on chain 3344, $PC and ETH on
 * Ethereum). It then shows ONE recommendation with at most two actions.
 * Read-only: no signatures, no transactions. Shadow DOM, no dependencies,
 * themed from the host's --pg-* variables when present.
 */
(function () {
  if (window.PCConnector) return;

  var HOME = 'https://pentagon.games';
  var RPC = 'https://rpc.pentagon.games';
  var ETH_RPCS = ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com', 'https://cloudflare-eth.com'];
  var API = 'https://api.account.pentagon.games';
  var PC_TOKEN = '0xA1Aa371E450C5AeE7fff259cbF5ccA9384227272';
  var PC_ID = 3344, PC_HEX = '0xd10';
  var ETH_DUST = 0.002;
  var LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAADdElEQVR42s2XPYgdVRTHf+dtNusSs2rEDwwIMfFjFTUIioiNxiKIFpaKlVpaRZBICsFCMEIqG3U1hUUUjI0WFkFTSCBGJEJi1kIFjRg1JrIrYnb3zc/mXLlM5r19G4XsgeHNzLvn63/OPfc/wQBRA+hFRD+frwO2Aw8BW4GNwKVAAH8CPwFfAQeAjyPiZOqNAU1EyKii9qr729TX1V8cXX5TZ9Q7umwu53wsfy9Rd6vnKsN9dUltOpw2+V+/ereo7lHX1bZHcX6j+kXLULMCBJrUKXJUnR4aROV8q/pzKi6s0HGXLFRlubsziFIfdZN6qsr6/5Ji67R6U+0zSrcDa4BDwF3AUj7X0s+OH7mXgTrTYvMYcA+wADQ19C+3ILPVfBci/QHl2FNKURC4Afg6I+61Mi2R7wY+zPtmSOa91HkYeKGFpqkrcDvwTemB1wbUvUT8Khcg6isdqBYfM6UHNgCzwFUZWcl+ERgH3oqIZ9Lg1cCLwGW5Jlo1B5gDXoqIU6kzAzxd2Ss+zgLTqI931KtE+X6WCHVKPTxi7T9X11dIfNCyW3w9hbq3mmL1ogPq2jQwqR5aYQMeUq9I/bXqwcp+mabvhnoUuDOh6WfDHAG2RcS8Og58AtwLnEwYh0kk3FPAm8DOfDcFHExfpTFnyeFghcBs1ho11E/VE+pGdZ06kRlNLHONq5PVyYp6rXo8s2/UOdS/qxez6uaqdh+pP6qXV+/WdFy9DLbXuqJaM5nPT1YJ9+v92QP2RsS36Wg/cB9wa0T8kajsA7ZU64vuRF7NgIlIQn4u15Ezpwn1NHBlKjdZt/XAg8D9EfG9OgEczvp1yQ/A88BfHUGUQM8Cu5LU9DOAefKo7Bqbb1SwT6i71DNVJy8kjHN12YYMpSfU7ypOoXpi0DZcrPbzA5WRm9V9VZBL2UOfqceSQ0wnYkVnW8f8+HcbDhpEtnjA2+qmyuijFXJFjquP5bZFvT712k7PG0Qb1F87nJaFTXWW7yjZZVfvzKyfrTjFuPqc+ntls9+R2Bn1muUOI1szQvWIun1AnR9Rvxyg13kYlWGzOcnn0hAK1uZ576hb0sa0+t4IHLL02qJ6ixqjEpJ2WfoVjPvV+Y7/hvHD8wjJKJSMDoo2NuS5Ld2U7D+S0maZsi1LSlcHLV8VHyar4tPsYnycxsX+PP8Hp21OK+ZsbR4AAAAASUVORK5CYII=';   // inlined: host-site CSPs often block remote images
  var ON_PG = /(^|\.)pentagon\.games$/.test(location.hostname);
  var SAME_ORIGIN_LOGIN = /^(www\.)?pentagon\.games$/.test(location.hostname);  // these also serve /api/auth/session
  /* Sign-in now works on ANY origin registered with identity: set
     data-client-id on this script tag (ask nftprof to register your exact
     origin). On pentagon.games itself no id is needed — it's the same-origin
     overlay. Without either, the sign-in entries are hidden rather than
     offered as a dead end. */
  var CLIENT_ID = (document.currentScript && document.currentScript.getAttribute('data-client-id')) || '';
  /* Points copy is load-bearing for the programme's legal position on sites
     that state what a user receives is in-ecosystem credit with no cash value
     (bridge/GetPC2). Points MUST NOT be described as convertible, withdrawable,
     bridgeable, or as having a "value" or being "worth" anything. They are an
     in-ecosystem balance, bought not earned, spend-only. A site may relabel the
     row with data-points-label; the default is already neutral. */
  var POINTS_LABEL = (document.currentScript && document.currentScript.getAttribute('data-points-label')) || 'Points';
  /* The pill's short form, beside the pink mark. A site that relabels the
     row gets its own label here too. */
  var POINTS_SHORT = (document.currentScript && document.currentScript.getAttribute('data-points-label')) || 'Pts';
  var HAS_LOGIN = SAME_ORIGIN_LOGIN || !!CLIENT_ID;
  var KEY = 'pc-connector-rdns';
  var PGAI_ICON = 'data:image/png;base64,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';
  // Our own wallet always shows as "PGAI Wallet" with the green PC mark, whatever the extension announces.
  function brand(info) {
    info = info || {};
    if (/pentagon ai|pgai/i.test(info.name || '') || /pentagon|pgai/i.test(info.rdns || '')) return { name: 'PGAI Wallet', icon: PGAI_ICON, rdns: info.rdns, uuid: info.uuid, ours: true };
    return info;
  }

  var ETH_SVG = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#8c8cff" d="M12 2 5.5 12.3 12 16.1l6.5-3.8z"/><path fill="#c0c0ff" d="M12 17.4 5.5 13.5 12 22l6.5-8.5z"/></svg>';
  var PC_IMG = '<img src="' + LOGO + '" width="16" height="16" alt="" style="border-radius:50%;background:#050807">';
  /* Brand marks (nftprof: "PC icon is the green version", "Points is the
     Pentagon Games logo in magenta"; "Use as provided. Do not edit, change or
     distort"). Inlined because host-site CSPs often block remote images.
     $PC: brand-kit pentagon-chain-token, the same file as
     /home2-assets/mark-pc.png at 64px (from 256px) so the widget does not
     carry 81KB on every partner page — no recolour, crop or distortion;
     64px covers the largest display (28px) at 2x. Points: the site's
     mark-points.webp byte-for-byte, at its native 100px. */
  var PCM = 'data:image/png;base64,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';
  var PTM = 'data:image/webp;base64,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';
  /* The address as the wallet itself shows it (Rabby: "0x1d187a...d3017a"),
     so the pill, the panel and the extension read the same at a glance
     (nftprof: "comfort and understanding seeing two are the same rather than
     guessing"). Six either side also still lines up with MetaMask's shorter
     checksummed form, since it shows more of both ends. */
  function shortAddr(a) { a = String(a || '').toLowerCase(); return a.length > 16 ? a.slice(0, 8) + '…' + a.slice(-6) : a; }
  function mark(src, px) { return '<img class="mk" src="' + src + '" width="' + px + '" height="' + px + '" alt="">'; }
  var DOT = '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:var(--pg-text-muted,#7e9486)"></span>';
  var CHAINS = { 1: ['Ethereum', ETH_SVG], 3344: ['Pentagon Chain', mark(PCM, 16)], 137: ['Polygon', DOT], 8453: ['Base', DOT], 56: ['BNB Chain', DOT], 42161: ['Arbitrum', DOT], 10: ['Optimism', DOT] };

  var st = {
    providers: [], p: null, acct: null, chain: null,
    pc: null, ethPc: null, eth: null, reading: false, readFailed: false,
    points: null, signedIn: false, pointsBlocked: false,
    mm: null, penai: null,                  // this account's own addresses (user/info)
    username: null,                         // the account's name, shown on the pill
    roaming: null,                          // {available, devices[]} — null until checked
    phone: false,                           // viewing the account's PGAI wallet by address (no provider)
    open: false, picking: false, err: '', notice: '',
    pending: '',                            // a wallet we are waiting on to answer a connect
    signing: false,                         // asking the wallet to sign the login message
    attached: false, hostConnect: null      // set by attach(): the host owns connect/disconnect
  };
  var pills = [], guides = [], listeners = [];

  // ---------------------------------------------------------------- discovery
  window.addEventListener('eip6963:announceProvider', function (e) {
    var d = e.detail; if (!d || !d.provider || !d.info) return;
    /* The LATEST announcement wins, per wallet. Keeping the first meant that a
       wallet which re-announces a fresh provider object (Rabby rebuilds its
       injected provider) left us calling a stale one — a reconnect that
       silently did nothing (nftprof, 2026-09-28: Rabby would not reconnect
       after Disconnect; PGAI would). */
    for (var i = 0; i < st.providers.length; i++) {
      var x = st.providers[i].info;
      if (x.uuid === d.info.uuid || (d.info.rdns && x.rdns === d.info.rdns)) { st.providers[i] = d; return; }
    }
    st.providers.push(d);
  });
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  function allProviders() {
    if (st.providers.length) return st.providers.slice().sort(function (a, b) { return (brand(b.info).ours ? 1 : 0) - (brand(a.info).ours ? 1 : 0); });
    return window.ethereum ? [{ info: { name: 'Browser wallet', rdns: 'injected', icon: '' }, provider: window.ethereum }] : [];
  }

  // -------------------------------------------------------------------- reads
  function post(url, method, params) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: method, params: params }) })
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d || typeof d.result !== 'string') throw new Error('bad rpc'); return d.result; });
  }
  function ethCall(method, params, i) {
    i = i || 0;
    return post(ETH_RPCS[i], method, params).catch(function (e) {
      if (i + 1 < ETH_RPCS.length) return ethCall(method, params, i + 1);
      throw e;
    });
  }
  var toNum = function (hex) { return Number(BigInt(hex === '0x' ? '0x0' : hex)) / 1e18; };

  function readBalances(quiet) {
    if (!st.acct) return;
    var a = st.acct;
    if (!quiet) { st.reading = true; st.readFailed = false; emit(); }
    var data = '0x70a08231' + a.slice(2).toLowerCase().padStart(64, '0');
    Promise.allSettled([
      post(RPC, 'eth_getBalance', [a, 'latest']),
      ethCall('eth_call', [{ to: PC_TOKEN, data: data }, 'latest']),
      ethCall('eth_getBalance', [a, 'latest'])
    ]).then(function (r) {
      if (st.acct !== a) return;
      st.pc = r[0].status === 'fulfilled' ? toNum(r[0].value) : null;
      st.ethPc = r[1].status === 'fulfilled' ? toNum(r[1].value) : null;
      st.eth = r[2].status === 'fulfilled' ? toNum(r[2].value) : null;
      st.readFailed = st.pc == null;   // an unread gas balance must never pass as "empty"
      st.reading = false; emit();
    });
  }
  function loginToken() {
    var t = null; try { t = localStorage.getItem('pg_token'); } catch (e) {}
    if (t) return Promise.resolve(t);
    if (!HAS_LOGIN) return Promise.resolve(null);
    return fetch('/api/auth/session', { credentials: 'include' }).then(function (r) { return r.json(); })
      .then(function (s) { return s && (s.token || s.accessToken) || null; }).catch(function () { return null; });
  }
  // Third-party sites get only a site-scoped token (Pentagon's own domains and
  // their subdomains get the full login token): Points via /sso/walletinfo.
  function readPointsSSO() {
    var t = null;
    try { t = (window.PGSignIn && PGSignIn.ssoToken && PGSignIn.ssoToken()) || localStorage.getItem('pg_sso_token'); } catch (e) {}
    if (!t) return;
    st.signedIn = true;
    fetch(API + '/sso/walletinfo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: t }) })
      .then(function (r) { if (!r.ok) throw new Error('auth'); return r.json(); })
      .then(function (d) {
        var res = (d && d.result) || d || {};
        if (res.npc_points == null) throw new Error('shape');
        st.points = Number(res.npc_points); emit();              // AA2 canonical only
      }).catch(function () { st.pointsBlocked = true; emit(); });
  }
  function readPoints() {
    if (!HAS_LOGIN) return;
    loginToken().then(function (t) {
      if (!t) return readPointsSSO();
      readOwnAddresses(t);
      checkRoaming(t);
      return fetch(API + '/user/walletinfo', { headers: { Authorization: 'Bearer ' + t } })
        .then(function (r) { if (!r.ok) throw new Error('auth'); return r.json(); })
        .then(function (d) {
          var res = d.result || {};
          st.signedIn = true;
          /* AA2 cutover (identity, 2026-09-27), same rule as #16 applies to
             /topup and home2: npc_points ONLY. The legacy pc_balance / balance
             fields empty out after the sweep, so deriving Points from them
             would quietly show 0 to someone whose AA2 balance is intact. */
          st.points = res.npc_points != null ? Number(res.npc_points) : null;
          emit();
        });
    }).catch(function () {
      /* Most often this origin isn't in identity's CORS allowlist (separate
         list from the sign-in registration). Drop the Points row rather than
         spin forever or show a misleading 0. */
      st.pointsBlocked = true; emit();
    });
  }

  /* The account's OWN addresses, so a connected wallet can be flagged when it
     isn't one of them (nftprof: "flag if it's not the same account as PG EOA /
     PGAI" — most things still work, it's just a connected wallet). */
  function readOwnAddresses(t) {
    fetch(API + '/user/info', { headers: { Authorization: 'Bearer ' + t } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var u = (d && (d.result || d.data || d)) || {};
        st.mm = u.mm_address || null; st.penai = u.penai_address || null;
        st.username = u.username || null;
        readPNS(u); emit();
      }).catch(function () {});
  }

  /* PNS (nftprof: "it should say signed in as nftprof (pns), and if user is
     not on pns, get pns now"). A PNS name is the account's identity when it
     is minted AND spatially bound to the account's wallet (mm_address) —
     that is the rule login resolution uses (pg-identity-docs, "PNS Login").
     There is no on-chain reverse lookup, so: the names that wallet owns from
     PNS's own index (the same call pns.pentagon.games "My Names" makes), then
     each one's binding confirmed on-chain, since the index is a cache.
     st.pns: the name; st.pnsKnown: we KNOW the answer. Any failed read leaves
     pnsKnown false and the panel says nothing — never "Get PNS" to someone
     who may already have one. */
  var PNS_API = 'https://api.peg.gg/api/nft/pegnames/owner/';
  var PNS_REG = '0xf97eb9f8293d1fd5587a809eb74518c300738d07';
  var PNS_SITE = 'https://pns.pentagon.games';
  function readPNS(u) {
    st.pns = null; st.pnsKnown = false;
    var given = u.pns_name || u.pns || u.pnsName;          // if identity ever returns it, take it
    if (given) { st.pns = String(given).toLowerCase(); st.pnsKnown = true; return; }
    var mm = st.mm && String(st.mm).toLowerCase();
    if (!mm) { st.pnsKnown = true; return; }              // no wallet on the account: nothing can be bound to it
    fetch(PNS_API + mm).then(function (r) { if (!r.ok) throw new Error('pns'); return r.json(); })
      .then(function (d) {
        if (!d || !d.success) throw new Error('pns');
        var names = (d.names || []).slice(0, 8);
        return Promise.all(names.map(function (n) {
          var id = BigInt(n.tokenId).toString(16); while (id.length < 64) id = '0' + id;
          return post(RPC, 'eth_call', [{ to: PNS_REG, data: '0x0dbfe0bf' + id }, 'latest'])   // spatialBinding(uint256)
            .then(function (r) { return r && r.length >= 66 ? '0x' + r.slice(-40) : null; },
                  function () { return (n.spatialBinding || '').toLowerCase() || null; })
            .then(function (b) { return b && b.toLowerCase() === mm ? String(n.name).toLowerCase() : null; });
        }));
      })
      .then(function (bound) {
        if (st.mm && String(st.mm).toLowerCase() !== mm) return;  // account changed meanwhile
        st.pns = bound.filter(Boolean)[0] || null; st.pnsKnown = true; emit();
      }).catch(function () {});
  }
  function whoName() { return st.pns || st.username; }

  /* Offer "approve in my Pentagon AI app" ONLY when the backend says this
     account has one. A phone or Telegram wallet is invisible to EIP-6963, so
     the browser can't know; and offering it to someone who never installed one
     is a dead end. Fails closed. */
  function checkRoaming(t) {
    loadSignIn().then(function (S) {
      if (!S.roamingAvailable) return;            // older cached pg-signin.js
      return S.roamingAvailable(t).then(function (r) { st.roaming = r; emit(); });
    }).catch(function () {});
  }

  /** 'primary' | 'pgai' | 'other' — is the connected wallet this account's own? */
  function ownership() {
    if (!st.signedIn || !st.acct) return null;
    // Unknown, not "other": without the account's own addresses (e.g. a
    // third-party site with only an SSO token) we can't say whose wallet it is.
    if (!st.mm && !st.penai) return null;
    var S = window.PGSignIn;
    if (S && S.walletOwnership) return S.walletOwnership(st.acct, st.mm, st.penai);
    var c = String(st.acct).toLowerCase();
    if (st.mm && st.mm.toLowerCase() === c) return 'primary';
    if (st.penai && st.penai.toLowerCase() === c) return 'pgai';
    return 'other';
  }

  // ----------------------------------------------------------------- actions
  /* Follow the wallet the way wagmi (Uniswap) does: its accountsChanged and
     chainChanged events, so switching account or network in the extension
     moves the pill with it. Which providers we already listen to is tracked
     HERE — we used to write a flag onto the wallet's own provider object, and
     a wallet that hands out a wrapped or locked provider (Rabby) can drop
     that write. Some providers expose addListener rather than on. resync()
     below is the backstop if an event still never arrives. */
  var bound = [];
  function bind(p) {
    if (bound.indexOf(p) >= 0) return;
    var on = p.on || p.addListener;
    if (typeof on !== 'function') return;
    bound.push(p);
    try {
      on.call(p, 'accountsChanged', function (a) {
        if (st.p !== p) return;                   // a provider we no longer follow
        var nx = a && a[0] || null;
        if (nx && st.acct && nx.toLowerCase() === st.acct.toLowerCase()) return;
        st.acct = nx; st.pc = st.ethPc = st.eth = null;
        if (st.acct) readBalances(); else { st.chain = null; emit(); }
      });
      on.call(p, 'chainChanged', function (c) { if (st.p === p) { st.chain = parseInt(c, 16); emit(); } });
    } catch (e) {}
  }
  function use(entry, silent) {
    if (st.attached) return Promise.resolve();      // the host's wallet button owns this
    if (!silent) st.phone = false;                  // a real connection replaces the phone view
    var p = entry.provider;
    /* A wallet may answer eth_requestAccounts with an approval window of its
       own — Rabby does when the account now selected has not been approved
       for this site. That window can open behind the browser; say we are
       waiting on it, rather than a panel that looks like nothing happened. */
    if (!silent) { st.pending = brand(entry.info).name || 'your wallet'; st.picking = false; st.err = ''; emit(); }
    return p.request({ method: silent ? 'eth_accounts' : 'eth_requestAccounts' }).then(function (acc) {
      if (!silent) st.pending = '';
      if (!acc || !acc.length || st.attached) { if (!silent) emit(); return; }
      st.p = p; st.w = entry.info || {}; st.acct = acc[0]; st.picking = false; st.err = '';
      try { localStorage.setItem(KEY, entry.info.rdns || 'injected'); } catch (e) {}
      bind(p);
      return p.request({ method: 'eth_chainId' }).then(function (c) { st.chain = parseInt(c, 16); readBalances(); })
        .then(function () { if (!silent && HAS_LOGIN && !st.signedIn) smartSignIn(); });
    }).catch(function (e) {
      if (!silent) {
        st.pending = '';
        st.err = (e && e.code === 4001) ? 'Cancelled in the wallet — nothing was shared.'
          : (e && e.code === -32002) ? (brand(entry.info).name || 'Your wallet') + ' already has a connection request open — open it to approve or reject that one first.'
          : 'Could not connect the wallet.';
        emit();
      }
    });
  }
  function connect() {
    if (st.attached) {                              // one connect button on the page: the host's
      st.open = false; emit();
      if (st.hostConnect) try { st.hostConnect(); } catch (e) {}
      return;
    }
    var list = allProviders();
    if (!list.length) { st.open = true; emit(); return; }
    if (list.length > 1) { st.open = true; st.picking = true; emit(); return; }
    use(list[0]);
  }
  function switchToPC() {
    if (!st.p) return;
    st.p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: PC_HEX }] }).catch(function (e) {
      if (e && (e.code === 4902 || /unrecognized|not added|unknown chain/i.test(e.message || ''))) {
        return st.p.request({ method: 'wallet_addEthereumChain', params: [{ chainId: PC_HEX, chainName: 'Pentagon Chain',
          nativeCurrency: { name: 'PC', symbol: 'PC', decimals: 18 }, rpcUrls: [RPC], blockExplorerUrls: ['https://explorer.pentagon.games'] }] });
      }
    }).catch(function () {});
  }
  /* To bridge Ethereum $PC the wallet has to be on Ethereum. The bridge page
     would ask anyway; asking here means the panel can then show the $PC
     and Bridge in the same place the user is already looking. */
  function switchToEth() {
    if (!st.p) return;
    st.p.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x1' }] }).catch(function () {});
  }
  /* ------------------------------------------------------------ resync
     nftprof, 2026-09-28: switched accounts in Rabby, and the pill kept the
     old address — "the website should already know right?". It should. We
     followed only the wallet's accountsChanged / chainChanged events, and a
     wallet that does not deliver one (or delivers it to a different provider
     object than the one announced over EIP-6963) leaves the pill describing
     a wallet the user has already left. So we also ASK: eth_accounts and
     eth_chainId are silent reads that never prompt. On opening the panel, on
     coming back to the tab, and every few seconds while it is visible. */
  function resync() {
    var p = st.p;
    if (!p || st.phone || st.attached || !st.acct) return;   // attached: the host calls attach() on change
    p.request({ method: 'eth_accounts' }).then(function (acc) {
      if (st.p !== p) return;
      var a = acc && acc[0] || null;
      if (!a) { st.acct = st.chain = st.pc = st.ethPc = st.eth = null; emit(); return; }
      var same = st.acct && a.toLowerCase() === st.acct.toLowerCase();
      return p.request({ method: 'eth_chainId' }).then(function (c) {
        var ch = parseInt(c, 16);
        if (same && ch === st.chain) return;
        if (!same) { st.acct = a; st.pc = st.ethPc = st.eth = null; }
        st.chain = ch;
        same ? emit() : readBalances();
      });
    }).catch(function () {});
  }
  window.addEventListener('focus', resync);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) resync(); });
  setInterval(function () { if (!document.hidden) resync(); }, 4000);

  function disconnect() {
    if (st.attached) return;                        // the host disconnects, then calls detach()
    st.acct = st.chain = st.pc = st.ethPc = st.eth = null; st.open = false;
    if (st.phone) { st.phone = false; emit(); return; }   // hiding a look forgets no wallet
    /* Let go of the wallet, not just its address. Keeping st.p meant its
       events still reached us: an account switch in the extension could
       re-attach a wallet the user had just disconnected. */
    st.p = null; st.w = null; st.pending = '';
    try { localStorage.removeItem(KEY); } catch (e) {}
    emit();
  }

  /* Sign out of the Pentagon ACCOUNT. Deliberately separate from disconnect():
     a wallet and an account are different things, and a user may well want to
     drop one and keep the other. Clears the token this origin holds (the
     library clears both pg_token and pg_sso_token) and everything derived from
     it, so no stale Points or account addresses survive on screen. */
  /* Everything this pill knows about the account, dropped. The phone view is
     the ACCOUNT's wallet, so it leaves with the account. */
  function forgetAccount() {
    st.signedIn = false; st.points = null; st.pointsBlocked = false;
    st.mm = st.penai = null; st.username = null; st.pns = null; st.pnsKnown = false; st.roaming = null; st.notice = ''; st.err = '';
    if (st.phone) { st.phone = false; st.acct = st.chain = st.pc = st.ethPc = st.eth = null; }
  }
  /* Sign-in and sign-out that happen OUTSIDE the pill: the host's own Log in
     (the overlay fires pg:auth on success), or another tab (storage). Without
     this, signing in from a site's nav left the pill blank until a reload.
     Our own sign-out's event is skipped — we already know. */
  window.addEventListener('pg:auth', function (e) {
    if (e && e.detail && e.detail.signedOut) return;
    readPoints();
  });
  window.addEventListener('storage', function (e) {
    if (!e || (e.key !== 'pg_token' && e.key !== 'pg_sso_token')) return;
    if (e.newValue) readPoints(); else { forgetAccount(); emit(); }
  });
  function signOut() {
    forgetAccount();
    st.open = false;
    try { localStorage.removeItem('pg_token'); localStorage.removeItem('pg_sso_token'); } catch (e) {}
    if (window.PGSignIn && window.PGSignIn.signOut) { try { window.PGSignIn.signOut(); } catch (e) {} }
    emit();
    /* Tell the page. `storage` does not fire in the tab that made the change,
       so without this a host's own nav (home2's account pill, a game's
       header) keeps showing a signed-in user after the pill signed them out.
       Same event the sign-in overlay fires on the way in (lib/pgAuth.ts). */
    try { window.dispatchEvent(new CustomEvent('pg:auth', { detail: { ok: false, signedOut: true } })); } catch (e) {}
  }

  // The host's provider becomes the one we follow. Safe to call on every
  // account/chain change the host sees; account may be omitted (read silently).
  function attach(provider, account, opts) {
    if (!provider || typeof provider.request !== 'function') throw new Error('PCConnector.attach needs an EIP-1193 provider');
    opts = opts || {};
    var same = st.attached && st.p === provider;
    st.attached = true; st.picking = false; st.err = '';
    if (typeof opts.connect === 'function') st.hostConnect = opts.connect;
    if (!same) {
      var known = st.providers.filter(function (x) { return x.provider === provider; })[0];
      st.p = provider;
      st.w = opts.name ? { name: opts.name, icon: opts.icon || '' } : (known ? known.info : { name: 'your wallet' });
      bind(provider);
    }
    var got = account !== undefined ? Promise.resolve(account ? [account] : [])
                                     : provider.request({ method: 'eth_accounts' }).catch(function () { return []; });
    return got.then(function (acc) {
      var a = acc && acc[0] || null;
      if (same && a === st.acct) return;
      st.acct = a; st.pc = st.ethPc = st.eth = null;
      if (!a) { st.chain = null; emit(); return; }
      return provider.request({ method: 'eth_chainId' }).then(function (c) { st.chain = parseInt(c, 16); }, function () {})
        .then(function () { readBalances(); });
    });
  }
  function detach() {
    st.attached = false; st.hostConnect = null; st.p = null; st.w = null;
    st.acct = st.chain = st.pc = st.ethPc = st.eth = null; st.open = false; st.picking = false; st.phone = false;
    emit();
  }

  // ------------------------------------------------------------ the decision
  function quoteHref() { return document.getElementById('get-pc') ? '#get-pc' : HOME + '/home2#get-pc'; }
  // The sign-in app only honours fixed continue keys (home2, redeem); anything
  // else strands the visitor inside the wallet app.
  var SIGN_IN = HOME + '/pgai/web-local-app/?continue=' + (/^\/redeem/.test(location.pathname) ? 'redeem' : 'home2');
  var signInP = null;
  function loadSignIn() {
    if (window.PGSignIn) return Promise.resolve(window.PGSignIn);
    return signInP || (signInP = new Promise(function (res, rej) {
      var sc = document.createElement('script');
      sc.src = SAME_ORIGIN_LOGIN ? '/pgai/web-local-app/pg-signin.js' : HOME + '/pgai/web-local-app/pg-signin.js'; sc.async = true;
      sc.onload = function () { window.PGSignIn ? res(window.PGSignIn) : rej(new Error('no PGSignIn')); };
      sc.onerror = function () { signInP = null; rej(new Error('pg-signin.js')); };
      document.head.appendChild(sc);
    }));
  }
  // Overlay on pentagon.games (the only origin that can keep the login); the
  // full-page sign-in is the fallback if the overlay script can't load.
  /* Top up in a popup window (nftprof: "should be pop up"). A card payment
     page needs its own top-level context — an iframe is the wrong container
     for a checkout — and a window the user closes can never strand them off
     the page they were on. Navigation is the fallback only when a popup is
     blocked, so the button never does nothing. Points land in the account;
     re-read them when the window closes. */
  function topUp(url) {
    /* Any pentagon.games/topup link, query kept (return_url and all) — a
       host's own "Top up" links can hand theirs straight to this. Anything
       else falls back to the plain page. */
    var dest = HOME + '/topup';
    if (typeof url === 'string') {
      var m = url.match(/^(?:https:\/\/pentagon\.games)?\/topup(\?[^#]*)?$/);
      if (m) dest = HOME + '/topup' + (m[1] || '');
    }
    st.open = false; emit();
    var w = 520, h = 760, x = 0, y = 0;
    try { x = (window.screenX || 0) + Math.max(0, ((window.outerWidth || w) - w) / 2);
          y = (window.screenY || 0) + Math.max(0, ((window.outerHeight || h) - h) / 3); } catch (e) {}
    var win = null;
    try { win = window.open(dest, 'pg-topup', 'width=' + w + ',height=' + h + ',left=' + Math.round(x) + ',top=' + Math.round(y)); } catch (e) {}
    if (!win) { location.href = dest; return; }
    try { win.focus(); } catch (e) {}
    var iv = setInterval(function () {
      var closed = true; try { closed = win.closed; } catch (e) {}
      if (closed) { clearInterval(iv); readPoints(); }
    }, 700);
  }
  /* Bridge in a popup window, like Top up (nftprof: "can we pop it up like the
     wallet"). A window, not an in-page frame: a wallet does not reliably give a
     provider to a cross-origin frame, and the approvals belong on the bridge's
     own origin. We pass the wallet the pill is using (so the bridge connects
     the SAME one) and the Ethereum $PC we can see, rounded DOWN so a pre-filled
     amount can never exceed the balance. The bridge treats both as hints: its
     terms, review and every wallet prompt still run. Whatever happens in
     there, re-read balances when it reports progress and when it closes. */
  var BRIDGE = 'https://bridge.pentagon.games';
  function bridgeUp() {
    var q = '?mode=popup';
    if (st.ethPc > 0) q += '&amount=' + (Math.floor(st.ethPc * 1e6) / 1e6).toFixed(6).replace(/\.?0+$/, '');
    var rd = st.w && st.w.rdns; if (rd && /^[a-z0-9][a-z0-9.-]{2,100}$/i.test(rd)) q += '&wallet=' + encodeURIComponent(rd);
    st.open = false; emit();
    var w = 480, h = 780, x = 0, y = 0;
    try { x = (window.screenX || 0) + Math.max(0, ((window.outerWidth || w) - w) / 2);
          y = (window.screenY || 0) + Math.max(0, ((window.outerHeight || h) - h) / 3); } catch (e) {}
    var win = null;
    try { win = window.open(BRIDGE + '/' + q, 'pg-bridge', 'width=' + w + ',height=' + h + ',left=' + Math.round(x) + ',top=' + Math.round(y)); } catch (e) {}
    if (!win) { location.href = BRIDGE + '/'; return; }
    try { win.focus(); } catch (e) {}
    var iv = setInterval(function () {
      var closed = true; try { closed = win.closed; } catch (e) {}
      if (closed) { clearInterval(iv); readBalances(true); }
    }, 1000);
  }
  /* The bridge's popup reports {type:'pg:bridge', status} \u2014 nothing else. */
  window.addEventListener('message', function (e) {
    if (e.origin !== BRIDGE || !e.data || e.data.type !== 'pg:bridge') return;
    readBalances(true);
  });
  function signIn() {
    st.open = false; emit();
    var done = function (r) {
      if (r && r.ok) { st.signedIn = true; readPoints(); }
      else if (r && r.reason === 'popup-blocked') { st.err = 'Allow pop-ups for this site, then try again.'; st.open = true; emit(); }
    };
    // Off pentagon.games the sign-in is a popup, which browsers only allow in
    // the click itself — so it must already be loaded (boot preloads it).
    if (window.PGSignIn) { PGSignIn.open({ clientId: CLIENT_ID }).then(done); return; }
    if (!SAME_ORIGIN_LOGIN) { st.err = 'Sign-in is still loading — try again in a moment.'; st.open = true; emit(); loadSignIn().catch(function () {}); return; }
    loadSignIn().then(function (S) { return S.open({ clientId: CLIENT_ID }); }).then(done, function () { location.href = SIGN_IN; });
  }

  /* Other entry order (nftprof): connect a wallet FIRST, then find the PG
     login that owns it. No account for that wallet is not an error — it's the
     moment to offer creating one. There is deliberately no address->account
     lookup: the signature is what proves control, so you only learn a wallet
     has an account if you own it. */
  /* One Connect, then log in if this wallet has an account (nftprof,
     2026-09-28: "connect wallet, and just smartly login if it's found ...
     reduce steps"). There is deliberately no address->account lookup (the
     standard: you only learn a wallet has an account by proving you own it),
     so "found" means: the wallet signs Pentagon's login message and identity
     answers with the account. It is a free signature, never a transaction.
     Declining is not an error — they stay connected, reading balances, and
     can log in with Pentagon from the same panel. */
  function smartSignIn() {
    st.notice = ''; st.err = '';
    loadSignIn().then(function (S) {
      if (!S.walletSignIn) return null;             // older cached pg-signin.js: stay connected
      st.pending = ''; st.signing = true; emit();
      return S.walletSignIn(st.p);
    }).then(function (r) {
      st.signing = false;
      if (r && r.ok) { st.signedIn = true; st.acct = st.acct || r.address; readPoints(); readBalances(); return; }
      if (r && r.reason === 'no-account') st.notice = 'This wallet isn\'t linked to a Pentagon account.';
      emit();
    }).catch(function () { st.signing = false; emit(); });
  }
  function connectThenSignIn() {
    st.err = ''; st.notice = ''; emit();
    loadSignIn().then(function (S) {
      if (!S.walletSignIn) throw new Error('old pg-signin.js');
      return S.walletSignIn(st.p);
    }).then(function (r) {
      if (r && r.ok) { st.signedIn = true; st.acct = st.acct || r.address; readPoints(); readBalances(); return; }
      if (r && r.reason === 'no-account') {
        st.notice = 'This wallet isn\'t linked to a Pentagon account.';
      } else if (r && r.reason === 'rejected') {
        st.err = 'Cancelled in the wallet — nothing was shared.';
      } else {
        st.err = 'Could not sign in with that wallet.';
      }
      emit();
    }).catch(function () { st.err = 'Could not sign in with that wallet.'; emit(); });
  }
  function fmt(v, d) { return Number(v).toLocaleString('en-US', { maximumFractionDigits: v >= 1000 ? 2 : (d || 4) }); }

  /* Ethereum $PC IS shown in the pill (nftprof, 2026-09-28, reversing the
     26 Sep "read it, never display it"): MetaMask doesn't show people what they
     hold, which is why the pill exists, and it always comes with the route to
     use it on Pentagon Chain. The PGAI wallet app itself stays chain-3344-only
     and never shows it. Always named as Ethereum $PC, separate from chain gas. */
  /* GetPC 2 is live but deliberately unannounced (signer separation, legal
     review and audit still open): a CTA in every pill would BE its public
     launch. Built, OFF until nftprof clears it (2026-09-28, via Apps/Bridge2). */
  var GETPC_CTA = false;
  /* A wallet that lives on Pentagon Chain only: the PGAI extension, the
     account's own PGAI address, or the phone view of it. */
  function isPGAI() { return st.phone || !!brand(st.w).ours || ownership() === 'pgai'; }

  /* ------------------------------------------------ the phone (roaming) view
     nftprof, 2026-09-28: the pill must "display roaming wallet's balance,
     while displaying which wallet it's connected", and show it only when
     "based on our backend info" the user has one — "especially for case of
     mobile app wallet like iOS".

     A wallet on a phone injects nothing into this browser; EIP-6963 cannot
     see it. The backend can: user/info carries the account's penai_address.
     A balance is a plain address read, so this needs no provider, no
     connection and no signature — it is a look, labelled as one. No
     penai_address, no door: never offer a wallet the account does not have.
     (Roaming SIGNING is deferred — docs/PILL-AND-WALLETS.md. This is the
     half that works without it.) */
  function phoneAct() {
    return (st.signedIn && st.penai && !st.acct) ? { label: 'Show my Pentagon AI wallet', action: 'phone' } : null;
  }
  function withPhone(acts) { var a = phoneAct(); return a ? acts.concat([a]) : acts; }
  function showPhone() {
    if (!st.penai) return;
    st.p = null; st.w = null; st.phone = true;
    st.acct = st.penai; st.chain = PC_ID;
    st.pc = st.ethPc = st.eth = null; st.picking = false; st.err = ''; st.open = true;
    readBalances();
  }

  function ethPcTiny() {
    // Lands on the Get $PC picker, which carries BOTH roads (bridge + GetPC).
    return st.ethPc > 0 && !isPGAI() ? { label: fmt(st.ethPc) + ' $PC on Ethereum — bridge to Pentagon Chain', href: 'https://bridge.pentagon.games' } : null;
  }

  function recommend() {
    if (st.reading) return { key: 'reading', head: 'Reading your balances…', acts: [] };
    /* Offered only to someone logged in: before login there is no account
       to hold Points and nothing being bought (nftprof: "they are not buying
       anything yet here, so that msg doesn't make sense"). */
    var card = { label: 'Top up Points', href: HOME + '/topup', action: 'topup' };
    // A connected wallet holding Ethereum $PC leads with it: the figure, and
    // bridge / GetPC as the main CTAs (nftprof, 2026-09-28) — ahead of chain gas
    // and Points, which stay in the summary line above.
    // They own $PC already, so the answer is "move what you have", not "buy".
    /* Not for a PGAI wallet or the phone view: PGAI is Pentagon Chain only
       and cannot sign on Ethereum, so "bridge it" would be a button it can
       never press. */
    if (st.acct && st.ethPc > 0 && !isPGAI()) {
      return { key: 'bridge', head: fmt(st.ethPc) + ' $PC on Ethereum',
        sub: 'Use it as gas on Pentagon Chain:',          // keep it short (nftprof): the sites explain the rest
        acts: [{ label: 'Bridge to Pentagon Chain', href: 'https://bridge.pentagon.games' }]
          .concat(GETPC_CTA ? [{ label: 'Lock on GetPC', href: 'https://getpc.pentagon.games' }] : []) };
    }
    if (st.acct && st.pc > 0) {
      var off = st.chain !== PC_ID;
      return { key: 'gas', ok: true, head: 'You have ' + fmt(st.pc) + ' PC gas on Pentagon Chain',
        sub: off ? 'Your wallet is on ' + ((CHAINS[st.chain] || ['another chain'])[0]) + ' — switch to Pentagon Chain to use it.' : 'You\'re set to play and transact on-chain.',
        acts: [off ? { label: 'Switch to Pentagon Chain', action: 'switch' } : { label: 'Explore the worlds', href: document.getElementById('worlds') ? '#worlds' : HOME + '/home2#worlds' },
               { label: 'Swap on PentaSwap', href: 'https://pentaswap.io' }], tiny: ethPcTiny() };
    }
    if (st.points > 0) {
      return { key: 'points', ok: true, head: (whoName() ? 'Hi ' + whoName() + ' — ' : 'You have ') + fmt(st.points, 0) + ' ' + POINTS_LABEL + '',
        sub: 'Spend them across Pentagon apps — no wallet or gas needed. In-ecosystem only: they cannot be withdrawn, bridged or cashed out.',
        acts: withPhone([{ label: 'Redeem for NFTs', href: 'https://pentagon.games/redeem' }, { label: 'Top up more', href: HOME + '/topup', action: 'topup' }]),
        // Signing in never hides connecting a wallet (nftprof): the two stack.
        tiny: st.acct ? ethPcTiny() : ((st.attached || allProviders().length) ? { label: 'Connect a wallet to see its PC too', href: '#', action: 'connect' } : null) };
    }
    if (st.acct && st.readFailed) return { key: 'failed', head: 'Couldn\'t read your PC gas right now', sub: 'Nothing was signed. Try again in a moment.',
      acts: [{ label: 'Try again', action: 'reread' }, card] };
    if (st.acct && st.eth > ETH_DUST) {
      return { key: 'buy', head: 'No $PC yet — you have ETH',
        sub: 'Buy $PC on Ethereum with our smart router, then bridge it in. Ethereum $PC is a separate token from the chain\'s gas.',
        acts: [{ label: 'Get a live quote', href: quoteHref() }, { label: 'Pay by card — no crypto', href: HOME + '/topup' }] };
    }
    if (st.acct) return { key: 'empty', head: 'Nothing in this wallet yet',
      acts: [card, { label: 'Buy $PC on Ethereum', href: quoteHref() }] };
    /* Signed out, the panel offers exactly two roads (nftprof: "do u really
       need two box? ... reduce steps"): Connect wallet — which logs you in
       too when the wallet has an account — and Log in with Pentagon, which
       opens the login box itself. No card top-up before login: Points live
       on an account, so there is nothing to top up yet. */
    var login = (HAS_LOGIN && !st.signedIn) ? { label: 'Log in with Pentagon', href: SIGN_IN, action: 'signin' } : null;
    var extra = [];
    if (roamingOffered()) extra.push({ label: 'Approve in my Pentagon AI app', action: 'signin' });
    if (phoneAct()) extra.push(phoneAct());
    if (st.attached || allProviders().length) {
      var a = [{ label: 'Connect wallet', action: 'connect' }];
      if (login) a.push(login);
      if (st.signedIn) a.push(card);
      return { key: 'unknown', head: login ? 'Log in or connect a wallet' : 'Connect a wallet',
        sub: login ? 'Connect to see what your wallet holds. If a Pentagon account owns it, one free signature logs you in — no transaction.'
                   : 'See the PC your wallet holds on Pentagon Chain and Ethereum.',
        acts: a.concat(extra), tiny: elsewhereTiny() };
    }
    if (login) return { key: 'nowallet', head: 'Log in to Pentagon', sub: 'Your Points, your Pentagon account, on every Pentagon site.',
      acts: [login].concat(extra),
      tiny: elsewhereTiny() || { label: 'No wallet? Get the PGAI Wallet', href: HOME + '/pentagon-chain/pgai-wallet/' } };
    return { key: 'nowallet', head: st.signedIn ? 'You\'re logged in' : 'No wallet needed',
      sub: st.signedIn ? 'Points work across every Pentagon app — no wallet or gas needed.' : 'Log in on a Pentagon site to use your Points.',
      acts: (st.signedIn ? [card] : [{ label: 'Get Pentagon AI', href: HOME + '/pentagon-chain/pgai-wallet/#get' }]).concat(extra),
      tiny: elsewhereTiny() || (HAS_LOGIN ? { label: 'Want a wallet? Get PGAI Wallet', href: HOME + '/pentagon-chain/pgai-wallet/' } : null) };
  }
  // Signed in on a site the account API doesn't CORS-allow yet: no blank, no 0.
  function elsewhereTiny() {
    return (!SAME_ORIGIN_LOGIN && st.signedIn && st.pointsBlocked && st.points == null)
      ? { label: 'Signed in. Your Points show on pentagon.games', href: HOME + '/home2' } : null;
  }

  /* Only when identity says this account has a Pentagon AI wallet somewhere.
     Never guessed: a phone or Telegram wallet cannot be detected in a browser,
     which is exactly the iOS case. Fails closed, so it is hidden on error. */
  function roamingOffered() { return !!(st.roaming && st.roaming.available); }

  function summary() {
    var bits = [];
    if (st.pc != null) bits.push('PC gas ' + fmt(st.pc));
    /* Signed in, the Points sit in the account line (or the head of the
       Points state) — the summary repeating them printed the same balance
       twice in one panel. */
    if (st.points != null && !st.signedIn) bits.push(POINTS_LABEL + ' ' + fmt(st.points, 0) + ' \u00b7 in-ecosystem');
    if (st.ethPc > 0) bits.push('Ethereum $PC ' + fmt(st.ethPc));
    return bits.join(' · ');
  }

  // ------------------------------------------------------------------- views
  var CSS = ':host{all:initial;font-family:var(--pg-font-body,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);color:var(--pg-text,#e8f5ec)}'
    + '*{box-sizing:border-box}'
    + 'a{color:var(--pg-accent-text,#4dff94);text-decoration:none}a:hover{text-decoration:underline}'
    + '.lab{font:600 10px/1.2 ui-monospace,"Cascadia Mono",monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--pg-text-muted,#7e9486);margin:0 0 5px}'
    + '.id{font:12px ui-monospace,"Cascadia Mono",monospace;color:var(--pg-text-muted,#7e9486)}'
    + '.row{display:flex;align-items:center;gap:8px;margin:0 0 12px}.row .sp{flex:1}.ic{display:inline-flex}'
    + '.g-sum{font:12px ui-monospace,"Cascadia Mono",monospace;color:var(--pg-text-muted,#7e9486);margin:0 0 6px}'
    + '.g-head{font:700 17px/1.25 var(--pg-font-display,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);margin:0 0 4px}.g-head.ok::before{content:"✓ ";color:var(--pg-accent,#00ff66)}'
    + '.g-sub{font-size:13.5px;line-height:1.45;color:var(--pg-text-muted,#7e9486);margin:0 0 12px}'
    + '.g-acts{display:flex;flex-wrap:wrap;gap:8px}'
    + '.btn{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:0 14px;border-radius:var(--pg-radius-small,4px);cursor:pointer;'
    + 'font:600 13.5px/1 var(--pg-font-display,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);border:1px solid var(--pg-accent,#00ff66);background:var(--pg-accent,#00ff66);color:var(--pg-on-accent,#03130a);text-decoration:none}'
    + '.btn:hover{text-decoration:none;filter:brightness(1.08)}'
    + '.btn.ghost{background:transparent;color:var(--pg-text,#e8f5ec);border-color:var(--pg-border-strong,#2c4033)}.btn.ghost:hover{border-color:var(--pg-accent,#00ff66)}'
    + '.g-tiny{margin:10px 0 0;font-size:12.5px}.err{color:var(--pg-danger-text,#ff7a90);font-size:12.5px;margin:0 0 8px}'
    + '.pill{display:inline-flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:999px;cursor:pointer;font:600 13px/1 var(--pg-font-display,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif);'
    + 'background:var(--pg-surface-raised,#131b16);color:var(--pg-text,#e8f5ec);border:1px solid var(--pg-border-strong,#2c4033);white-space:nowrap}'
    + '.mk{display:inline-block;vertical-align:middle;border-radius:50%;flex:none}'
    + '.box{border:1px solid var(--pg-border,#1e2b22);border-radius:var(--pg-radius,6px);padding:12px;margin:0 0 10px;background:var(--pg-surface-raised,#131b16)}'
    + '.box.acct{display:flex;align-items:center;justify-content:space-between;gap:10px;background:transparent;border:0;border-bottom:1px solid var(--pg-border,#1e2b22);border-radius:0;padding:0 0 10px;font-size:13px}'
    + '.box.acct b{color:var(--pg-accent-text,#4dff94)}.box.acct .mk{margin:-2px 1px 0 2px}.box.acct a{white-space:nowrap}'
    + '.who>div{min-width:0}.who>div>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.box .who{margin:0 0 10px;padding:0;border:0;font-size:14px}'
    + '.who .sp{flex:1}'
    + '.netchip{display:inline-flex;align-items:center;gap:6px;padding:3px 9px 3px 5px;border-radius:999px;border:1px solid var(--pg-border-strong,#2c4033);font-size:12px;white-space:nowrap}'
    + '.netchip .ic img,.netchip .ic svg{width:16px;height:16px}'
    + '.big{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:4px 0 6px}'
    + '.big b{font:700 26px/1 var(--pg-font-display,system-ui,sans-serif);color:var(--pg-accent-text,#4dff94)}'
    + '.big .u{font:700 16px/1 var(--pg-font-display,system-ui,sans-serif)}.big .on{flex-basis:100%;font-size:12.5px;color:var(--pg-text-muted,#7e9486);margin-left:36px;margin-top:-2px}'
    + '.big-note{font-size:15px;margin:0 0 6px}'
    + '.ok{font-size:13px;color:var(--pg-accent-text,#4dff94);margin:2px 0 0}'
    + '.warn{font-size:13px;color:var(--pg-warning,#ffc24d);margin:2px 0 8px}'
    + '.sub{font-size:13px;line-height:1.45;color:var(--pg-text-muted,#7e9486);margin:0 0 10px}'
    + '.box.also{background:transparent;border-style:dashed;opacity:.85}.box.also .line{display:flex;align-items:center;gap:8px;font-size:14px;margin:0 0 6px}'
    + '.box.also.hl{opacity:1;border-style:solid;border-color:var(--pg-accent,#00ff66);background:var(--pg-accent-soft,rgba(0,255,102,.08))}'
    + '.ro.tiny{font-size:11.5px;margin:2px 0 0}'
    + '.pill .nm{color:var(--pg-text,#e8f5ec)}.pill .dot{opacity:.5}'
    + '.pill.two{height:auto;min-height:34px;padding:4px 12px}'
    + '.pill .rows{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px}'
    + '.pill .r1{display:inline-flex;align-items:center;gap:7px}'
    + '.pill .r2{font:500 10.5px/1.1 ui-monospace,"Cascadia Mono",monospace;color:var(--pg-text-muted,#7e9486);letter-spacing:.01em;white-space:nowrap}'
    + '@media (max-width:480px){.pill .wn2{display:none}}'
    /* Under 360px there is room for one figure: the PC where you are. Points
       stay one tap away, in the panel's account box. */
    + '.pill .ptseg{display:inline-flex;align-items:center;gap:7px}'
    + '@media (max-width:359px){.pill .ptseg{display:none}}'
    + '.acct{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;padding:0 0 10px;border-bottom:1px solid var(--pg-border,#1e2b22);font-size:13px}'
    + '.pns{display:inline-block;margin-left:4px;padding:1px 5px;border:1px solid var(--pg-accent,#00ff66);border-radius:4px;font:700 9.5px/1.3 ui-monospace,monospace;letter-spacing:.06em;color:var(--pg-accent-text,#4dff94);text-decoration:none;vertical-align:1px}'
    + '.getpns{margin-left:6px;font-size:11.5px;white-space:nowrap}'
    + '.g-pns{font-size:12px;color:var(--pg-text-muted,#7e9486);margin:-2px 0 10px}.g-pns .pns{margin:0 4px 0 0}.g-pns .getpns{margin:0}'
    + '.acct b{color:var(--pg-accent-text,#4dff94)}.acct .ab{display:flex;flex-direction:column;gap:3px;min-width:0}.acct .ap{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;color:var(--pg-text,#e8f5ec)}'
    + '.pill .net{color:var(--pg-text-muted,#7e9486);font-weight:500}.pill .dv{width:1px;height:14px;background:var(--pg-border-strong,#2c4033)}'
    + '@media (max-width:480px){.pill .net,.pill .dv{display:none}}'
    /* Phones: the pill is the only login in the nav, so it must fit beside
       the logo, menu and theme button. The name goes first (the panel greets
       by name anyway), then the word "Points"; the number and caret stay. */
    + '@media (max-width:560px){.pill .nm,.pill .dot{display:none}.pill{padding:0 10px}}'
    + '@media (max-width:359px){.pill .pl{display:none}}'
    + '.pill:hover{border-color:var(--pg-accent,#00ff66)}.pill b{color:var(--pg-accent-text,#4dff94)}.car{opacity:.6;font-size:10px}'
    + '.wrap{position:relative;display:inline-block}'
    + '.panel{position:absolute;right:0;top:40px;z-index:2147483000;width:310px;max-width:calc(100vw - 24px);padding:14px;border-radius:var(--pg-radius,6px);'
    + 'background:var(--pg-surface,#0c120e);border:1px solid var(--pg-border-strong,#2c4033);box-shadow:0 10px 30px rgba(0,0,0,.5);font-size:13px}'
    + '.sep{border-top:1px solid var(--pg-border,#1e2b22);margin:12px 0}'
    + '.foot{display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;font-size:12px}'
    + '.w{display:flex;align-items:center;gap:8px;width:100%;padding:9px;margin:0 0 6px;border-radius:var(--pg-radius-small,4px);cursor:pointer;'
    + 'background:var(--pg-surface-raised,#131b16);color:var(--pg-text,#e8f5ec);border:1px solid var(--pg-border,#1e2b22);font:600 13px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left}'
    + '.w:hover{border-color:var(--pg-accent,#00ff66)}.w img{width:20px;height:20px}'
    + '.guide{padding:2px 0}'
    + '.who{display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:0 0 12px;border-bottom:1px solid var(--pg-border,#1e2b22);font-size:14px}'
    + '.ro{font-size:11.5px;color:var(--pg-text-muted,#7e9486);margin:-2px 0 10px}'
    + '.who img{width:28px;height:28px;border-radius:6px}.who .ic img{width:28px;height:28px}.who b{color:var(--pg-accent-text,#4dff94)}';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function chainChip(id) {
    var c = CHAINS[id] || ['Chain', DOT];
    return '<span class="netchip" title="chain id ' + id + '"><span class="ic">' + c[1] + '</span>' + c[0] + '</span>';
  }
  function actHTML(a, i) {
    var cls = 'btn' + (i ? ' ghost' : '');
    if (a.action && a.href) return '<a class="' + cls + '" href="' + esc(a.href) + '" data-a="' + a.action + '">' + esc(a.label) + '</a>';
    return a.action ? '<button type="button" class="' + cls + '" data-a="' + a.action + '">' + esc(a.label) + '</button>'
                    : '<a class="' + cls + '" href="' + esc(a.href) + '">' + esc(a.label) + '</a>';
  }
  function guideHTML() {
    if (st.picking) {
      return '<div class="lab">Select a wallet</div>' + allProviders().map(function (w, i) {
        var b = brand(w.info);
        return '<button class="w" data-pick="' + i + '">' + (b.icon ? '<img alt="" src="' + esc(b.icon) + '">' : '') + esc(b.name) + '</button>';
      }).join('');
    }
    var r = recommend(), sum = summary();
    return (st.err ? '<div class="err">' + esc(st.err) + '</div>' : '')
      + (sum ? '<div class="g-sum">' + esc(sum) + '</div>' : '')
      + '<div class="g-head' + (r.ok ? ' ok' : '') + '">' + esc(r.head) + '</div>'
      + (r.key === 'points' && st.signedIn ? pnsLine() : '')
      + (r.sub ? '<div class="g-sub">' + esc(r.sub) + '</div>' : '')
      + (r.acts.length ? '<div class="g-acts">' + r.acts.map(actHTML).join('') + '</div>' : '')
      + (r.tiny ? '<div class="g-tiny"><a href="' + esc(r.tiny.href) + '"' + (r.tiny.action ? ' data-a="' + r.tiny.action + '"' : '') + '>' + esc(r.tiny.label) + '</a></div>' : '');
  }
  /* Who is signed in, and their Points, while the rest of the panel is about
     a wallet. Without it, connecting a wallet pushed the account out of the
     pill entirely — and the pill is the only login on the page. */
  /* BOX 1 — the account (nftprof: "Points PG login good"). Its Points wear
     the magenta Points mark. */
  /* Beside the name: a PNS tag when the name IS the account's PNS name, else
     — only once we know there is none — "Get PNS", in a new tab. */
  function pnsHTML() {
    if (st.pns) return ' <a class="pns" href="' + PNS_SITE + '" target="_blank" rel="noopener" title="Your Pentagon Name Service name">PNS</a>';
    if (st.pnsKnown) return ' <a class="getpns" href="' + PNS_SITE + '" target="_blank" rel="noopener">Get PNS ↗</a>';
    return '';
  }
  /* The same, as its own line under "Hi name —" when no wallet is connected. */
  function pnsLine() {
    if (st.pns) return '<div class="g-pns"><a class="pns" href="' + PNS_SITE + '" target="_blank" rel="noopener">PNS</a> your on-chain name</div>';
    if (st.pnsKnown) return '<div class="g-pns">No PNS name yet · <a class="getpns" href="' + PNS_SITE + '" target="_blank" rel="noopener">Get PNS ↗</a></div>';
    return '';
  }
  function acctHTML() {
    if (!st.acct) return '';
    /* Connected but logged out: the pill is the page's only login, so the top
       of the panel says so and offers it. Without this, a visitor who
       connected a wallet had no way left to log in except disconnecting. */
    if (!st.signedIn) return HAS_LOGIN ? '<div class="box acct"><span>Not logged in to Pentagon</span>'
      + '<a href="' + SIGN_IN + '" data-a="signin">Log in with Pentagon</a></div>' : '';
    /* Two rows: who, then their Points (nftprof: "either wrap points to 2nd
       row or ..."). On one line the number broke from its label at 310px. */
    return '<div class="box acct"><span class="ab"><span>Signed in as <b>' + esc(whoName() || 'your account') + '</b>' + pnsHTML() + '</span>'
      + (st.points != null ? '<span class="ap">' + mark(PTM, 14) + ' ' + fmt(st.points, 0) + ' ' + esc(POINTS_LABEL) + '</span>' : '') + '</span>'
      + '<a href="' + HOME + '/topup" data-a="topup">Top up</a></div>';
  }

  /* The connected panel, in three boxes (nftprof, 2026-09-28):
       1  the account: who, their Points, Top up;
       2  NOW: which wallet, which network, and the PC it holds THERE, big,
          with the $PC mark; plus the one thing to do about it;
       3  ALSO: PC waiting on the other chain, and the switch to reach it.
     "Split the NOW vs what else you can do." Box 3 is a low-lit shelf while
     box 2 already has PC to use, and becomes the headline when it has none:
     "if they got no PC on PC, this becomes a big deal". */
  function onEth() { return st.chain === 1; }
  function onPC() { return st.phone || st.chain === PC_ID; }
  function nowHTML() {
    var w = brand(st.w), h = '';
    var ic = st.phone ? '<img alt="" src="' + PGAI_ICON + '">' : (w.icon ? '<img alt="" src="' + esc(w.icon) + '">' : '<span class="ic">' + PC_IMG + '</span>');
    h += '<div class="who">' + ic + '<div><div>' + (st.phone ? 'Your <b>Pentagon AI</b> wallet · on your phone' : '<b>' + esc(w.name || 'Your wallet') + '</b>') + '</div>'
      + '<a class="id" target="_blank" rel="noopener" href="' + (onEth() ? 'https://etherscan.io/address/' : 'https://explorer.pentagon.games/address/') + st.acct + '">' + shortAddr(st.acct) + ' ↗</a></div>'
      + '</div>';   // the network is named under the balance ("on Pentagon Chain") and on the pill
    var own = ownership();
    if (own === 'other') h += '<div class="ro">Not your account’s wallet — these balances are this wallet’s. Your Points stay on your account.</div>';
    else if (own === 'pgai' || st.phone) h += '<div class="ro">Your PGAI wallet — Pentagon Chain only.</div>';
    var rd = function (v) { return st.reading ? '…' : (v == null ? '—' : fmt(v)); };
    if (onPC()) {
      h += '<div class="big">' + mark(PCM, 28) + '<b>' + rd(st.pc) + '</b><span class="u">PC</span><span class="on">on Pentagon Chain</span></div>';
      if (st.readFailed && !st.reading) h += '<div class="g-acts"><button class="btn ghost" data-a="reread" type="button">Couldn’t read — try again</button></div>';
      else if (st.pc > 0) h += '<div class="ok">✓ Ready to play and transact on Pentagon Chain.</div>';
      else if (!st.reading && !(st.ethPc > 0 && !isPGAI())) h += '<div class="warn">No PC gas yet — you need some to transact here.</div>'
        + '<div class="g-acts"><a class="btn" href="' + quoteHref() + '">Get $PC</a></div>';
      else if (!st.reading) h += '<div class="warn">No PC gas yet — but you hold $PC on Ethereum. See below.</div>';
    } else if (onEth()) {
      h += '<div class="big">' + mark(PCM, 28) + '<b>' + rd(st.ethPc) + '</b><span class="u">$PC</span><span class="on">on Ethereum</span></div>';
      if (st.ethPc > 0) h += '<div class="sub">Bridge it and it becomes your gas on Pentagon Chain.</div>'
        + '<div class="g-acts"><a class="btn" href="' + BRIDGE + '/" data-a="bridge">Bridge to Pentagon Chain \u2197</a></div>'
        + '<div class="ro tiny">Opens bridge.pentagon.games in a window. Your wallet may ask to connect there the first time.</div>';
      else if (!st.reading) h += '<div class="warn">No $PC on Ethereum in this wallet.</div>'
        + (st.pc > 0 ? '' : '<div class="g-acts"><a class="btn" href="' + quoteHref() + '">Get $PC</a></div>');
    } else {
      h += '<div class="sub">This wallet is on ' + esc((CHAINS[st.chain] || ['another network'])[0]) + '. PC lives on Pentagon Chain.</div>'
        + '<div class="g-acts"><button class="btn" data-a="switch" type="button">Switch to Pentagon Chain</button></div>';
    }
    return '<div class="box now">' + h + '</div>';
  }
  function alsoHTML() {
    if (st.phone || isPGAI() || st.reading) return '';
    if (onPC() && st.ethPc > 0) {
      var hl = !(st.pc > 0);
      return '<div class="box also' + (hl ? ' hl' : '') + '"><div class="lab">' + (hl ? 'Your next step' : 'Also in this wallet') + '</div>'
        + '<div class="line">' + mark(PCM, 16) + '<span><b>' + fmt(st.ethPc) + ' $PC</b> on Ethereum</span></div>'
        + '<div class="sub">Switch to Ethereum, then bridge it to Pentagon Chain' + (hl ? ' — that is your gas here.' : '.') + '</div>'
        + '<div class="g-acts"><button class="btn' + (hl ? '' : ' ghost') + '" data-a="switch-eth" type="button">Switch to Ethereum</button></div></div>';
    }
    if (onEth() && st.pc > 0) {
      var hl2 = !(st.ethPc > 0);
      return '<div class="box also' + (hl2 ? ' hl' : '') + '"><div class="lab">' + (hl2 ? 'Your next step' : 'Also in this wallet') + '</div>'
        + '<div class="line">' + mark(PCM, 16) + '<span><b>' + fmt(st.pc) + ' PC</b> on Pentagon Chain</span></div>'
        + '<div class="g-acts"><button class="btn' + (hl2 ? '' : ' ghost') + '" data-a="switch" type="button">Switch to Pentagon Chain</button></div></div>';
    }
    return '';
  }
  function panelHTML() {
    var h = acctHTML();
    /* Offer both: most people who see this already HAVE an account and simply
       connected a wallet that isn't linked to it (nftprof, 2026-09-28). */
    if (st.notice) h += '<div class="ro">' + esc(st.notice) + ' '
      + (HAS_LOGIN ? '<a href="' + SIGN_IN + '" data-a="signin">Log in with Pentagon</a>, or ' : '')
      + '<a href="' + HOME + '/pgai/web-local-app/?signup=1&continue=home2">create an account' + (HAS_LOGIN ? ' for it' : '') + '</a>.</div>';
    if (st.signing) {
      return h + '<div class="box now"><div class="big-note">Check your wallet</div>'
        + '<div class="sub">Sign Pentagon’s login message to log in with this wallet. It is free and moves nothing. Decline and you stay connected, just not logged in.</div></div>';
    }
    if (st.pending) {
      return h + '<div class="box now"><div class="big-note">Waiting for <b>' + esc(st.pending) + '</b></div>'
        + '<div class="sub">Approve the connection in ' + esc(st.pending) + '. If its window didn’t appear, click the ' + esc(st.pending) + ' icon in your browser’s toolbar.</div>'
        + '<div class="g-acts"><button class="btn ghost" data-a="cancel-wait" type="button">Cancel</button></div></div>';
    }
    if (st.acct && !st.picking) {
      if (st.err) h += '<div class="err">' + esc(st.err) + '</div>';
      h += nowHTML() + alsoHTML()
        + '<div class="ro tiny">' + (st.phone ? 'Read-only, by address. To move anything, open the Pentagon AI app.' : 'We never move anything. Logging in with a wallet is a free signature, not a transaction.') + '</div>';
    } else {
      h += guideHTML();
    }
    if (st.signedIn || (st.acct && !st.attached)) {
      h += '<div class="sep"></div><div class="foot"><span></span>'
        + (st.signedIn ? '<button class="btn ghost" data-a="signout" type="button">Sign out</button>' : '')
        + (st.acct && !st.attached ? '<button class="btn ghost" data-a="disconnect" type="button">' + (st.phone ? 'Hide' : 'Disconnect wallet') + '</button>' : '')
        + '</div>';
    }
    return h;
  }

  /* Short network names for the pill; the full name stays in the tooltip
     and the panel. */
  var NET = { 1: 'Ethereum', 3344: 'Pentagon', 137: 'Polygon', 8453: 'Base', 56: 'BNB', 42161: 'Arbitrum', 10: 'Optimism' };
  function pillHTML() {
    /* The caret is what says "this opens". Without it a Points balance reads
       as a label, and sign-in, connect and the phone wallet behind it are
       invisible to anyone who does not think to click a number. */
    /* The pill is the page's ONLY login (nftprof, 2026-09-28: "u just need the
       single widget pill"), so it names the account: signed in, who and their
       Points; signed out on a site that can sign in, "Log in". */
    if (!st.acct) {
      var label;
      /* Signed in, no wallet: just the pink mark, the number and "Pts"
         (nftprof: "when only login no wallet connect then show only pink
         3,690 Pts"). The pink mark belongs to the number, never the name —
         the name is in the panel's greeting. */
      if (st.points != null && (st.signedIn || st.points > 0)) label = '<b>' + fmt(st.points, 0) + '</b> <span class="pl">' + esc(POINTS_SHORT) + '</span>';
      else if (st.signedIn) label = whoName() ? '<b class="nm">' + esc(whoName()) + '</b>' : 'Your account';
      else label = HAS_LOGIN ? 'Log in' : 'Connect wallet';
      /* Points wear the magenta Points mark (nftprof: "disconnected don't show
         the Points logo"); signed out, the brand mark stays. */
      return '<span class="ic">' + (st.points != null && (st.signedIn || st.points > 0) ? mark(PTM, 18) : PC_IMG) + '</span>' + label + '<span class="car">▾</span>';
    }
    var c = CHAINS[st.chain] || ['chain ' + st.chain, DOT];
    var rd = function (x) { return st.reading ? '…' : (x == null ? '—' : fmt(x)); };
    var who = st.phone ? 'Pentagon AI wallet · read-only' : (brand(st.w).name || 'Wallet');
    /* The PC you hold WHERE YOU ARE, with the $PC mark (nftprof: "show PC on
       Pentagon Chain more obvious with the $PC logo"). On Ethereum that is
       your $PC token, not your Pentagon Chain gas — showing gas beside the
       word "Ethereum" was the confusion. Other networks hold no PC: name the
       network and let the panel offer the switch. */
    var net = '<span class="net">' + esc(st.phone ? 'Pentagon' : (NET[st.chain] || c[0])) + '</span>';
    /* Signed in AND connected: Points, then the PC where you are, then the
       network (nftprof: "can pill show Points and PC? ... Points, PC and
       current network"). The name gives way — the panel's account box has
       it — and the word "Points" too: the pink mark carries it. */
    var pts = (st.signedIn && st.points != null)
      ? '<span class="ptseg"><span class="ic">' + mark(PTM, 16) + '</span><b class="pts">' + fmt(st.points, 0) + '</b><span class="dot">·</span></span>' : '';   // the pink mark says "Points" (nftprof: "just show the pink pentagon")
    /* Second row: which wallet, and its address in the wallet's own format. */
    var r2 = '<span class="r2"><span class="wn2">' + esc(st.phone ? 'Pentagon AI' : (brand(st.w).name || 'Wallet')) + ' · </span>' + esc(shortAddr(st.acct)) + '</span>';
    var r1;
    if (st.phone || st.chain === PC_ID || st.chain === 1) {
      var eth = !st.phone && st.chain === 1;
      r1 = pts + '<span class="ic" title="' + esc(who + ' · ' + (eth ? 'Ethereum' : 'Pentagon Chain')) + '">' + mark(PCM, pts ? 16 : 18) + '</span>'
        + '<b>' + rd(eth ? st.ethPc : st.pc) + '<span class="un"> ' + (eth ? '$PC' : 'PC') + '</span></b><span class="dv"></span>' + net;
    } else {
      r1 = pts + '<span class="ic" title="' + esc(who + ' · ' + c[0]) + '">' + c[1] + '</span>' + net + '<span class="dv"></span><span>Switch</span>';
    }
    return '<span class="rows"><span class="r1">' + r1 + '</span>' + r2 + '</span><span class="car">▾</span>';
  }

  function emit() {
    /* Redraw only what changed. Replacing the panel's HTML between a press
       and its release swaps the element under the pointer, and the browser
       then drops the click — picking a wallet could silently do nothing if
       any update landed mid-click. */
    pills.forEach(function (r) {
      var ph = pillHTML(), bh = st.open ? panelHTML() : '';
      if (r.pill.__h !== ph) { r.pill.innerHTML = ph; r.pill.__h = ph; r.pill.classList.toggle('two', !!st.acct); }
      r.pill.setAttribute('aria-expanded', st.open ? 'true' : 'false');
      if (r.panel.__h !== bh) { r.panel.innerHTML = bh; r.panel.__h = bh; }
      r.panel.style.display = st.open ? 'block' : 'none';
    });
    guides.forEach(function (g) { g.body.innerHTML = guideHTML(); });
    listeners.forEach(function (fn) { try { fn(api.state()); } catch (e) {} });
  }

  function wire(root, host) {
    root.addEventListener('click', function (e) {
      var t = e.target.closest('[data-pick],[data-a],a[href^="#"]'); if (!t) return;
      if (t.dataset.pick != null) return use(allProviders()[+t.dataset.pick]);
      if (t.dataset.a === 'signin' || t.dataset.a === 'topup' || t.dataset.a === 'bridge') {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // new tab: plain link
        e.preventDefault(); t.dataset.a === 'topup' ? topUp() : t.dataset.a === 'bridge' ? bridgeUp() : signIn(); return;
      }
      if (t.tagName === 'A' && t.dataset.a) e.preventDefault();   // link-styled action: run it below
      else if (t.tagName === 'A') {                // in-page jump from inside a modal: close it first
        var dlg = host.closest('dialog'); if (dlg && dlg.open) dlg.close();
        st.open = false; emit(); return;
      }
      var a = t.dataset.a;
      if (a === 'connect') connect();
      else if (a === 'connect-signin') connectThenSignIn();
      else if (a === 'signout') signOut();
      else if (a === 'phone') showPhone();
      else if (a === 'switch') switchToPC();
      else if (a === 'switch-eth') switchToEth();
      else if (a === 'cancel-wait') { st.pending = ''; emit(); }
      else if (a === 'disconnect') disconnect();
      else if (a === 'reread') readBalances();
    });
  }
  // A shadow root can't be removed, so a remount reuses it (el.__pcRoot).
  function shadow(el) { return el.__pcRoot || (el.__pcRoot = el.attachShadow({ mode: 'open' })); }
  function mountPill(el) {
    if (el.__pc) return; el.__pc = true;
    var sh = shadow(el);
    sh.innerHTML = '<style>' + CSS + '</style><span class="wrap"><button class="pill" type="button" aria-haspopup="dialog" aria-expanded="false"></button><div class="panel" role="dialog" aria-label="PC wallet"></div></span>';
    var r = { el: el, pill: sh.querySelector('.pill'), panel: sh.querySelector('.panel') };
    r.outside = function (e) { if (st.open && !el.contains(e.target)) { st.open = false; st.picking = false; emit(); } };
    pills.push(r); if (!sh.__pcWired) { sh.__pcWired = true; wire(sh, el); }
    r.pill.addEventListener('click', function () { st.open = !st.open; if (!st.open) st.picking = false; emit(); });
    document.addEventListener('click', r.outside);
    emit();
  }
  function mountGuide(el) {
    if (el.__pc) return; el.__pc = true;
    var sh = shadow(el);
    sh.innerHTML = '<style>' + CSS + '</style><div class="guide"></div>';
    var g = { el: el, body: sh.querySelector('.guide') };
    guides.push(g); if (!sh.__pcWired) { sh.__pcWired = true; wire(sh, el); } emit();
  }
  function unmount(el) {
    if (!el || !el.__pc) return;
    pills = pills.filter(function (r) { if (r.el !== el) return true; document.removeEventListener('click', r.outside); return false; });
    guides = guides.filter(function (g) { return g.el !== el; });
    if (el.__pcRoot) el.__pcRoot.innerHTML = '';
    el.__pc = false;
  }

  var api = {
    state: function () { return { account: st.acct, chainId: st.chain, pcGas: st.pc, ethPc: st.ethPc, eth: st.eth, points: st.points, recommendation: recommend().key }; },
    onChange: function (fn) { listeners.push(fn); },
    connect: connect, switchToPentagonChain: switchToPC,
    /* PENTAGON-LOGIN-STANDARD.md makes showing Points a MUST, and also says
       sign-in registration does not put an origin on the identity API's CORS
       allowlist — so a compliant site can have the Points read refused
       through no fault of its own. Its answer: read Points server-side and
       pass them in. This is the way in. null clears. */
    setPoints: function (n) {
      st.points = (n == null || n === '') ? null : Number(n);
      if (st.points != null) { st.signedIn = true; st.pointsBlocked = false; }
      emit();
    },
    /* The same sign-out the pill's own button runs, for a host's account menu. */
    signOut: signOut,
    /* Open the pill's sign-in (the same overlay its own button uses), for a
       host's other "log in" prompts — so a page never grows a second login. */
    signIn: signIn,
    topUp: topUp,
    mount: function (el) { el.hasAttribute('data-pc-guide') ? mountGuide(el) : mountPill(el); },
    unmount: unmount, attach: attach, detach: detach,
    version: '1.0.8'
  };
  window.PCConnector = api;

  function boot() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-pc-connector]'), mountPill);
    Array.prototype.forEach.call(document.querySelectorAll('[data-pc-guide]'), mountGuide);
    if (!SAME_ORIGIN_LOGIN && CLIENT_ID) loadSignIn().then(readPoints, readPoints);   // preload: popup must open in-click
    else readPoints();
    var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
    setTimeout(function () {                        // silent: eth_accounts never prompts
      var list = allProviders();
      var hit = saved && (list.filter(function (w) { return w.info.rdns === saved; })[0] || (saved === 'injected' && list[0]));
      if (hit && !st.attached) use(hit, true); else emit();
    }, 300);
    setInterval(function () { if (st.acct && !document.hidden) readBalances(true); }, 60000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
