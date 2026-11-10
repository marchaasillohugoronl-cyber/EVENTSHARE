'use client';

import { useEffect, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import type { Post } from '@/lib/tipos';
import './CartaNuevaFoto.css';

export default function CartaNuevaFoto({ post, onComplete }: { post: Post; onComplete: (id: string) => void }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // No bloquea la presentación si la foto no carga. El tiempo de lectura empieza al cargar.
    const timer = setTimeout(() => onComplete(post.id), ready ? 10500 : 10000);
    return () => clearTimeout(timer);
  }, [ready, post.id, onComplete]);

  return <section className={`photo-letter${ready ? ' photo-letter--ready' : ''}`} aria-label="Nuevo recuerdo del evento" aria-hidden={!ready}>
    <div className="photo-letter-glow" aria-hidden="true" />
    <div className="photo-letter-intro" role="status"><Sparkles size={22} aria-hidden="true" /><span>Ha llegado un nuevo recuerdo</span></div>
    <div className="photo-letter-scene">
      <div className="photo-letter-envelope" aria-hidden="true">
        <div className="photo-letter-back" />
        <div className="photo-letter-flap" />
        <div className="photo-letter-front" />
        <span className="photo-letter-seal">✦</span>
      </div>
      <figure className="photo-letter-card">
        <img src={post.photoUrl!} alt={`Nuevo recuerdo compartido por ${post.author.name}`} onLoad={() => setReady(true)} onError={() => onComplete(post.id)} />
        <figcaption><span>Un momento para recordar</span><strong>{post.author.name}</strong></figcaption>
      </figure>
    </div>
    <p className="photo-letter-footer">Gracias por ser parte de esta historia</p>
    {ready && <button type="button" className="photo-letter-close" onClick={() => onComplete(post.id)} aria-label="Cerrar nueva foto"><X size={20} aria-hidden="true" /></button>}
  </section>;
}
