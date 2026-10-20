'use client';

import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { esVideo } from '@/lib/video';
import type { Post } from '@/lib/tipos';

const SWAP_MS = 5500; // ritmo de lectura cómodo para pantallas de exposición
const SLOTS = 3;
const ORDER = [1, 0, 2]; // 1 = centro, 0 = izquierda, 2 = derecha

type State = { slots: number[]; next: number; step: number };
const initial = (): State => ({ slots: [0, 1, 2].map(i => i), next: SLOTS, step: 0 });
function reducer(s: State): State {
  const slots = s.slots.slice();
  slots[ORDER[s.step % SLOTS]] = s.next;
  return { slots, next: s.next + 1, step: s.step + 1 };
}

type Props = { posts: Post[]; name: string; subtitle?: string; caption?: string };

export default function TrioEnmarcado({
  posts,
  name,
}: Props) {
  const [state, tick] = useReducer(reducer, undefined, initial);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());

  const media = useMemo(
    () => posts.filter(p => p.photoUrl && !failed.has(p.id)),
    [posts, failed]
  );
  const total = media.length;

  const markFailed = useCallback((id: string) => {
    setFailed(prev => new Set(prev).add(id));
  }, []);

  useEffect(() => {
    if (total < 2) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') tick();
    }, SWAP_MS);
    return () => clearInterval(timer);
  }, [total]);

  if (total === 0) {
    return (
      <div className="trio-stage">
        <p className="trio-empty">Aún no hay fotos ni videos para mostrar.</p>
      </div>
    );
  }

  return (
    <div className="trio-stage">
      <div className="trio-shade" />

      <div className="trio-row" role="group" aria-label={`Fotos del evento ${name}`}>
        {[0, 1, 2].map(i => {
          const slot = state.slots[i];
          const post = media[slot % total];
          if (!post?.photoUrl) return null;
          const cls = i === 1 ? 'is-center' : i === 0 ? 'is-left' : 'is-right';
          return (
            <div key={i} className={`trio-frame ${cls}`}>
              <div className="trio-photo">
                {esVideo(post.photoUrl) ? (
                  <video
                    key={`${slot}-${post.id}`}
                    src={post.photoUrl}
                    autoPlay
                    muted
                    playsInline
                    loop
                    preload="metadata"
                    aria-label={`Video de ${post.author.name}`}
                    onError={() => markFailed(post.id)}
                  />
                ) : (
                  <img
                    key={`${slot}-${post.id}`}
                    src={post.photoUrl}
                    alt={`Foto de ${post.author.name}`}
                    decoding="async"
                    onError={() => markFailed(post.id)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
