'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LandingForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const valid = /^[A-Za-z0-9]{6,12}$/.test(code.trim());
  return (
    <form className="mt-10 flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); if (valid) router.push(`/e/${code.trim().toUpperCase()}`); }}>
      <input className="field uppercase tracking-widest" value={code} maxLength={12} placeholder="Código del evento"
        aria-label="Código del evento" autoCapitalize="characters" onChange={(e) => setCode(e.target.value)} />
      <button className="btn btn-primary shrink-0" disabled={!valid}>Entrar</button>
    </form>
  );
}
