/**
 * PentagonLoginModal.tsx
 * 
 * Drop-in React login modal for Pentagon Games Identity API.
 * Supports all 4 sign-in methods:
 *   1. Email + Password
 *   2. PNS Name + Password  
 *   3. Current Username + Password
 *   4. Wallet Signature (MetaMask/Rabby/Phantom via wagmi)
 * 
 * Requirements:
 *   npm install wagmi viem @rainbow-me/rainbowkit
 * 
 * Usage:
 *   const [showLogin, setShowLogin] = useState(false);
 *   <button onClick={() => setShowLogin(true)}>Sign In</button>
 *   <PentagonLoginModal
 *     isOpen={showLogin}
 *     onClose={() => setShowLogin(false)}
 *     onLogin={({ access_token }) => { saveToken(access_token); loadUser(); }}
 *   />
 * 
 * DO NOT redirect users to pentagon.games/sign-in. This modal handles
 * authentication entirely within your app via API calls.
 */

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

const PG_API = 'https://api.account.pentagon.games';
const APP_KEY = process.env.NEXT_PUBLIC_PG_APP_KEY;

interface LoginResult {
  access_token: string;
  refresh_token: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (result: LoginResult) => void;
  appName?: string; // Your app name for login_from tracking
}

export function PentagonLoginModal({ isOpen, onClose, onLogin, appName = 'your_app' }: Props) {
  const [tab, setTab] = useState<'email' | 'wallet' | 'magic'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicSent, setMagicSent] = useState(false);
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { openConnectModal } = useConnectModal();

  // Email/Password/PNS login (type="email" handles all three)
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${PG_API}/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PG-App-Key': APP_KEY!
        },
        body: JSON.stringify({
          type: 'email',
          username: email,   // email, PNS name, or username all work here
          password,
          login_from: appName
        })
      });
      const data = await res.json();
      if (data.status) {
        onLogin(data.result);
        onClose();
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) { setError('Network error'); }
    finally { setLoading(false); }
  };

  // Wallet signature login
  const handleWalletLogin = async () => {
    if (!isConnected) { openConnectModal?.(); return; }
    setLoading(true); setError('');
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `Logging into Pentagon Games,${timestamp}`;
      const signature = await signMessageAsync({ message });
      const res = await fetch(`${PG_API}/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PG-App-Key': APP_KEY!
        },
        body: JSON.stringify({
          type: 'wallet',
          signature,
          address: address!.toLowerCase(),
          message,
          login_from: appName
        })
      });
      const data = await res.json();
      if (data.status) {
        onLogin(data.result);
        onClose();
      } else {
        setError(data.message || 'Wallet not linked to an account');
      }
    } catch (err) { setError('Signature rejected or failed'); }
    finally { setLoading(false); }
  };

  // Magic link (passwordless email)
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${PG_API}/user/login/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-PG-App-Key': APP_KEY!
        },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.status) {
        setMagicSent(true);
      } else {
        setError(data.message || 'Failed to send magic link');
      }
    } catch (err) { setError('Network error'); }
    finally { setLoading(false); }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#12121a', border: '1px solid #2a2a3a', borderRadius: 16,
        padding: 32, width: 420, maxWidth: '90vw', color: '#e0e0e8'
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>⛊ Sign In</h2>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #2a2a3a', marginBottom: 20 }}>
          {(['email', 'wallet', 'magic'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); setError(''); setMagicSent(false); }} style={{
              padding: '8px 16px', background: 'none', border: 'none', cursor: 'pointer',
              color: tab === t ? '#7c5cff' : '#8888a0', fontSize: 14,
              borderBottom: tab === t ? '2px solid #7c5cff' : '2px solid transparent'
            }}>
              {t === 'email' ? 'Email / PNS' : t === 'wallet' ? 'Wallet' : 'Magic Link'}
            </button>
          ))}
        </div>

        {error && <div style={{ color: '#ff4c6a', fontSize: 14, marginBottom: 12 }}>{error}</div>}

        {tab === 'email' && (
          <form onSubmit={handleEmailLogin}>
            <input placeholder="Email, PNS name, or username" value={email}
              onChange={e => setEmail(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} style={inputStyle} />
            <button type="submit" disabled={loading} style={btnStyle}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <p style={{ fontSize: 12, color: '#8888a0', marginTop: 8, textAlign: 'center' }}>
              Works with email address, PNS on-chain name, or PG username
            </p>
          </form>
        )}

        {tab === 'wallet' && (
          <>
            <button onClick={handleWalletLogin} disabled={loading} style={btnStyle}>
              {loading ? 'Confirming...' : isConnected
                ? `Sign with ${address!.slice(0, 6)}...${address!.slice(-4)}`
                : 'Connect Wallet'}
            </button>
            <p style={{ fontSize: 12, color: '#8888a0', marginTop: 8, textAlign: 'center' }}>
              Wallet must be previously bound to a Pentagon account
            </p>
          </>
        )}

        {tab === 'magic' && (
          magicSent ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>✉️ Check your email</p>
              <p style={{ fontSize: 14, color: '#8888a0' }}>
                We sent a login link to <strong>{email}</strong>
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink}>
              <input placeholder="Email address" value={email} type="email"
                onChange={e => setEmail(e.target.value)} style={inputStyle} />
              <button type="submit" disabled={loading} style={btnStyle}>
                {loading ? 'Sending...' : 'Send Login Link'}
              </button>
              <p style={{ fontSize: 12, color: '#8888a0', marginTop: 8, textAlign: 'center' }}>
                No password needed. We'll email you a one-click login link.
              </p>
            </form>
          )
        )}

        <button onClick={onClose} style={{
          marginTop: 16, background: 'none', border: 'none',
          color: '#8888a0', cursor: 'pointer', width: '100%', textAlign: 'center'
        }}>Cancel</button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', marginBottom: 12, borderRadius: 8,
  border: '1px solid #2a2a3a', background: '#0a0a0f', color: '#e0e0e8',
  fontSize: 14, outline: 'none'
};

const btnStyle: React.CSSProperties = {
  width: '100%', padding: '12px', borderRadius: 8, border: 'none',
  background: '#7c5cff', color: 'white', fontSize: 15,
  fontWeight: 600, cursor: 'pointer'
};
