/**
 * pentagon-login.js
 * 
 * Vanilla JS login modal for Pentagon Games Identity API.
 * No framework dependencies. Add to any HTML page.
 * 
 * Supports:
 *   - Email + Password login
 *   - PNS Name + Password login
 *   - Username + Password login
 *   - Magic Link (passwordless email)
 * 
 * For wallet signature login, use the React version with wagmi,
 * or implement wallet signing separately and call the API.
 * 
 * Usage:
 *   <script src="pentagon-login.js"></script>
 *   <button onclick="showPentagonLogin(onSuccess)">Sign In</button>
 * 
 * DO NOT redirect users to pentagon.games/sign-in.
 */

const PG_API = 'https://api.account.pentagon.games';

/**
 * Show a Pentagon login modal overlay.
 * @param {function} onSuccess - Called with { access_token, refresh_token } on successful login
 * @param {object} options - { appKey: string, appName?: string }
 */
function showPentagonLogin(onSuccess, options = {}) {
  const APP_KEY = options.appKey || window.PG_APP_KEY || '';
  const APP_NAME = options.appName || 'your_app';

  if (!APP_KEY) {
    console.error('Pentagon Login: No app key provided. Pass options.appKey or set window.PG_APP_KEY');
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
    display:flex; align-items:center; justify-content:center;
  `;

  overlay.innerHTML = `
    <div style="background:#12121a; border:1px solid #2a2a3a; border-radius:16px;
      padding:32px; width:420px; max-width:90vw; color:#e0e0e8; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <h2 style="margin:0 0 20px; font-size:20px;">⛊ Sign In</h2>
      
      <div style="display:flex; gap:0; border-bottom:1px solid #2a2a3a; margin-bottom:20px;">
        <button class="pg-tab pg-tab-active" data-tab="email" style="padding:8px 16px; background:none; border:none; cursor:pointer; color:#7c5cff; font-size:14px; border-bottom:2px solid #7c5cff;">Email / PNS</button>
        <button class="pg-tab" data-tab="magic" style="padding:8px 16px; background:none; border:none; cursor:pointer; color:#8888a0; font-size:14px; border-bottom:2px solid transparent;">Magic Link</button>
      </div>

      <div id="pg-error" style="color:#ff4c6a; font-size:14px; margin-bottom:8px; display:none;"></div>

      <div id="pg-panel-email">
        <input id="pg-email" placeholder="Email, PNS name, or username"
          style="width:100%; padding:10px 14px; margin-bottom:12px; border-radius:8px;
          border:1px solid #2a2a3a; background:#0a0a0f; color:#e0e0e8; font-size:14px; outline:none; box-sizing:border-box;" />
        <input id="pg-pass" type="password" placeholder="Password"
          style="width:100%; padding:10px 14px; margin-bottom:12px; border-radius:8px;
          border:1px solid #2a2a3a; background:#0a0a0f; color:#e0e0e8; font-size:14px; outline:none; box-sizing:border-box;" />
        <button id="pg-submit" style="width:100%; padding:12px; border-radius:8px;
          border:none; background:#7c5cff; color:white; font-size:15px;
          font-weight:600; cursor:pointer;">Sign In</button>
        <p style="font-size:12px; color:#8888a0; margin-top:8px; text-align:center;">
          Works with email address, PNS on-chain name, or PG username
        </p>
      </div>

      <div id="pg-panel-magic" style="display:none;">
        <input id="pg-magic-email" placeholder="Email address" type="email"
          style="width:100%; padding:10px 14px; margin-bottom:12px; border-radius:8px;
          border:1px solid #2a2a3a; background:#0a0a0f; color:#e0e0e8; font-size:14px; outline:none; box-sizing:border-box;" />
        <button id="pg-magic-submit" style="width:100%; padding:12px; border-radius:8px;
          border:none; background:#7c5cff; color:white; font-size:15px;
          font-weight:600; cursor:pointer;">Send Login Link</button>
        <p style="font-size:12px; color:#8888a0; margin-top:8px; text-align:center;">
          No password needed. We'll email you a one-click login link.
        </p>
      </div>

      <div id="pg-panel-magic-sent" style="display:none; text-align:center; padding:20px 0;">
        <p style="font-size:16px; margin-bottom:8px;">✉️ Check your email</p>
        <p id="pg-magic-sent-msg" style="font-size:14px; color:#8888a0;"></p>
      </div>

      <button id="pg-cancel" style="margin-top:12px; width:100%; background:none;
        border:none; color:#8888a0; cursor:pointer; font-size:14px;">Cancel</button>
    </div>
  `;

  // Close handlers
  overlay.querySelector('#pg-cancel').onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  // Tab switching
  const tabs = overlay.querySelectorAll('.pg-tab');
  const panels = {
    email: overlay.querySelector('#pg-panel-email'),
    magic: overlay.querySelector('#pg-panel-magic'),
  };
  const errEl = overlay.querySelector('#pg-error');

  tabs.forEach(tab => {
    tab.onclick = () => {
      tabs.forEach(t => { t.style.color = '#8888a0'; t.style.borderBottom = '2px solid transparent'; t.classList.remove('pg-tab-active'); });
      tab.style.color = '#7c5cff'; tab.style.borderBottom = '2px solid #7c5cff'; tab.classList.add('pg-tab-active');
      errEl.style.display = 'none';
      Object.values(panels).forEach(p => p.style.display = 'none');
      overlay.querySelector('#pg-panel-magic-sent').style.display = 'none';
      const target = tab.getAttribute('data-tab');
      if (panels[target]) panels[target].style.display = 'block';
    };
  });

  // Email/Password/PNS login
  overlay.querySelector('#pg-submit').onclick = async () => {
    const email = overlay.querySelector('#pg-email').value;
    const pass = overlay.querySelector('#pg-pass').value;
    errEl.style.display = 'none';
    try {
      const res = await fetch(`${PG_API}/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PG-App-Key': APP_KEY },
        body: JSON.stringify({ type: 'email', username: email, password: pass, login_from: APP_NAME })
      });
      const data = await res.json();
      if (data.status) {
        overlay.remove();
        onSuccess(data.result);
      } else {
        errEl.textContent = data.message || 'Login failed';
        errEl.style.display = 'block';
      }
    } catch (e) {
      errEl.textContent = 'Network error';
      errEl.style.display = 'block';
    }
  };

  // Magic link
  overlay.querySelector('#pg-magic-submit').onclick = async () => {
    const magicEmail = overlay.querySelector('#pg-magic-email').value;
    errEl.style.display = 'none';
    try {
      const res = await fetch(`${PG_API}/user/login/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-PG-App-Key': APP_KEY },
        body: JSON.stringify({ email: magicEmail })
      });
      const data = await res.json();
      if (data.status) {
        panels.magic.style.display = 'none';
        const sentPanel = overlay.querySelector('#pg-panel-magic-sent');
        sentPanel.style.display = 'block';
        sentPanel.querySelector('#pg-magic-sent-msg').textContent = `We sent a login link to ${magicEmail}`;
      } else {
        errEl.textContent = data.message || 'Failed to send magic link';
        errEl.style.display = 'block';
      }
    } catch (e) {
      errEl.textContent = 'Network error';
      errEl.style.display = 'block';
    }
  };

  // Enter key submits
  overlay.querySelector('#pg-pass').onkeydown = (e) => {
    if (e.key === 'Enter') overlay.querySelector('#pg-submit').click();
  };
  overlay.querySelector('#pg-magic-email').onkeydown = (e) => {
    if (e.key === 'Enter') overlay.querySelector('#pg-magic-submit').click();
  };

  document.body.appendChild(overlay);
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { showPentagonLogin };
}
