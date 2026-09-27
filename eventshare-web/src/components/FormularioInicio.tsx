'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import EscanerQr from './EscanerQr';

export default function LandingForm() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const closeScanner = useCallback(() => setScanning(false), []);
  const openEvent = useCallback((value: string) => {
    setScanning(false);
    setCode(value);
    router.push(`/e/${value}`);
  }, [router]);
  const valid = /^[A-Za-z0-9]{6,12}$/.test(code.trim());
  return (
    <div className="mt-10 w-full max-w-sm">
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (valid) openEvent(code.trim().toUpperCase()); }}>
      <input className="field min-w-0 uppercase tracking-widest" value={code} maxLength={12} placeholder="Código del evento"
        aria-label="Código del evento" autoCapitalize="characters" onChange={(e) => setCode(e.target.value)} />
      <button className="btn btn-primary shrink-0" disabled={!valid}>Entrar</button>
    </form>
    {!scanning && <button type="button" className="btn btn-ghost mt-3 w-full" onClick={() => setScanning(true)}>Abrir cámara para escanear QR</button>}
    {scanning && <EscanerQr onCode={openEvent} onClose={closeScanner} />}
    </div>
  );
}
