'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/tipos';
import IdentityForm from './FormularioIdentidad';

type Ctx = {
  user: User | null;
  ready: boolean;
  /** Devuelve true si el usuario ya tiene identidad o la crea en el momento (Google / invitado). */
  ensureIdentity: (eventCode: string) => Promise<boolean>;
};

const SessionContext = createContext<Ctx>({ user: null, ready: false, ensureIdentity: async () => false });
export const useSession = () => useContext(SessionContext);

export default function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [sheet, setSheet] = useState<{ code: string } | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  useEffect(() => {
    api<{ user: User | null }>('/auth/me')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  const ensureIdentity = useCallback((code: string) => {
    if (userRef.current) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setSheet({ code });
    });
  }, []);

  const finish = useCallback((u: User | null) => {
    if (u) setUser(u);
    setSheet(null);
    resolver.current?.(!!u);
    resolver.current = null;
  }, []);

  return (
    <SessionContext.Provider value={{ user, ready, ensureIdentity }}>
      {children}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-ink/50 sm:items-center sm:justify-center" onClick={() => finish(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="identity-title"
            className="w-full animate-sheet rounded-t-3xl bg-paper p-6 pb-8 sm:max-w-sm sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="identity-title" className="font-serif text-2xl">¿Quién eres?</h2>
                <p className="mt-1 text-sm text-muted">Así los demás sabrán quién compartió cada foto.</p>
              </div>
              <button aria-label="Cerrar" className="-mr-2 -mt-2 h-10 w-10 rounded-full text-2xl leading-none text-muted" onClick={() => finish(null)}>×</button>
            </div>
            <IdentityForm eventCode={sheet.code} onDone={finish} />
          </div>
        </div>
      )}
    </SessionContext.Provider>
  );
}
