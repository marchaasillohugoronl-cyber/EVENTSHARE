'use client';

import { SharePhotoButton } from '@/components/CompartirFoto';
import Link from 'next/link';
import { ImagePlus, Images, LayoutGrid, type LucideIcon } from 'lucide-react';
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
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-3">
        {item(`/e/${code}`, 'Muro', path === `/e/${code}`, LayoutGrid)}
        {canPost && (
          <SharePhotoButton className="btn btn-primary nav-upload"><ImagePlus size={20} aria-hidden="true" />Compartir foto</SharePhotoButton>
        )}
        {item(`/e/${code}/photos`, 'Álbum', path === `/e/${code}/photos`, Images)}
      </div>

    </nav>
  );
}
