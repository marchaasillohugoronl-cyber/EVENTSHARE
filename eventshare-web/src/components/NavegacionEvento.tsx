'use client';

import Link from 'next/link';
import { Camera, Images, LayoutGrid, type LucideIcon } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function EventNav({ code, canPost }: { code: string; canPost: boolean }) {
  const path = usePathname();
  const item = (href: string, label: string, active: boolean, Icon: LucideIcon) => (
    <Link href={href} aria-current={active ? 'page' : undefined}
      className={`nav-item flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs ${active ? 'font-semibold text-brand' : 'text-muted'}`}>
      <Icon size={20} strokeWidth={active ? 2.2 : 1.7} aria-hidden="true" />
      {label}
    </Link>
  );
  return (
    <nav aria-label="Navegación del evento"
      className="event-nav fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-2">
        {item(`/e/${code}`, 'Muro', path === `/e/${code}`, LayoutGrid)}
        {canPost && (
          <Link href={`/e/${code}/upload`} className="btn btn-primary nav-upload" aria-current={path === `/e/${code}/upload` ? 'page' : undefined}><Camera size={20} aria-hidden="true" />Subir foto</Link>
        )}
        {item(`/e/${code}/photos`, 'Álbum', path === `/e/${code}/photos`, Images)}
      </div>
    </nav>
  );
}
