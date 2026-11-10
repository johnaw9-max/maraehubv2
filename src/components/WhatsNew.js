import React, { useState, useEffect } from 'react';
import { ANNOUNCEMENTS, activeAnnouncement, localDay } from '../lib/whatsNewItems';

const STORAGE_KEY = 'maraehub_seen_announcement';

function readSeen() {
  try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
}

export default function WhatsNew() {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    setAnnouncement(activeAnnouncement(ANNOUNCEMENTS, localDay(), readSeen()));
  }, []);

  function dismiss() {
    try { localStorage.setItem(STORAGE_KEY, announcement.id); } catch (e) { /* private mode: it just shows again next visit */ }
    setAnnouncement(null);
  }

  if (!announcement) return null;

  return (
    <div
      onClick={e => e.target === e.currentTarget && dismiss()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 24, overflowY: 'auto' }}
    >
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 520, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: 'linear-gradient(135deg, #1a4a3a 0%, #2e7d52 100%)', padding: '24px 28px 20px' }}>
          <div style={{ display: 'inline-block', background: '#c8902a', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', marginBottom: 8 }}>
            {announcement.badge || 'NEW'}
          </div>
          <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 24, fontWeight: 700, color: '#c8902a', lineHeight: 1.2 }}>
            {announcement.title}
          </div>
          {announcement.subtitle && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6 }}>{announcement.subtitle}</div>}
        </div>

        <div style={{ padding: '20px 28px 24px', overflowY: 'auto' }}>
          {announcement.items.map(item => (
            <div key={item.title} style={{ background: '#f0f7f4', border: '1px solid #a8d8c0', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: '#1a4a3a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--brand)' }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{item.where}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0 }}>{item.text}</p>
            </div>
          ))}

          <button onClick={dismiss} style={{ width: '100%', padding: '13px', marginTop: 6, background: 'var(--brand)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
            Got it — let's go
          </button>
          <div style={{ textAlign: 'center', marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
            This message goes away by itself after a few days. Find help anytime using the ❓ Help button.
          </div>
        </div>
      </div>
    </div>
  );
}
