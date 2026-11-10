'use client';

import { useRef, useState } from 'react';
import { Download, LoaderCircle } from 'lucide-react';

export default function DownloadPhoto({ postId }: { postId: string }) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/posts/${encodeURIComponent(postId)}/download`, { credentials: 'same-origin' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message || 'No se pudo descargar la foto. Inténtalo de nuevo.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] || `eventshare-${postId}.jpg`;
      document.body.appendChild(link); link.click(); link.remove();
      // Safari necesita que la URL siga disponible después del clic.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo descargar la foto.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <div className="photo-download">
    <button type="button" onClick={download} disabled={busy} className="photo-download-button" aria-label={busy ? 'Descargando foto' : 'Descargar foto'} aria-busy={busy}>
      {busy ? <LoaderCircle size={18} strokeWidth={1.7} className="upload-spinner" aria-hidden="true" /> : <Download size={18} strokeWidth={1.7} aria-hidden="true" />}
      <span>{busy ? 'Descargando…' : 'Descargar foto'}</span>
    </button>
    {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
  </div>;
}
