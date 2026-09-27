'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function EventNav({ code, canPost }: { code: string; canPost: boolean }) {
  const path = usePathname();
  const item = (href: string, label: string, active: boolean) => (
    <Link href={href} aria-current={active ? 'page' : undefined}
      className={`flex h-14 flex-1 items-center justify-center text-sm ${active ? 'font-semibold text-ink' : 'text-muted'}`}>
      {label}
    </Link>
  );
  return (
    <nav aria-label="Navegación del evento"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex max-w-xl items-center px-2">
        {item(`/e/${code}`, 'Muro', path === `/e/${code}`)}
        {canPost && (
          <Link href={`/e/${code}/upload`} className="btn btn-primary -mt-6 h-14 px-7 shadow-lg" aria-label="Subir foto">Subir foto</Link>
        )}
        {item(`/e/${code}/photos`, 'Álbum', path === `/e/${code}/photos`)}
      </div>
    </nav>
  );
}
