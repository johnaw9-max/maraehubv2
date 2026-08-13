import React from 'react';

export default function FormError({ message }) {
  if (!message) return null;
  return (
    <div style={{ background: '#faeae7', border: '1px solid #f0b8b0', borderRadius: 8, padding: '10px 14px', color: 'var(--danger)', fontSize: 14, marginBottom: 14 }}>
      {message}
    </div>
  );
}
