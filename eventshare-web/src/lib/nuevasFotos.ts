import type { Post } from './tipos';
import { esVideo } from './video';

/** La primera respuesta es la colección inicial, no una llegada de fotos nuevas. */
export class NewPhotoTracker {
  private initialized = false;
  private seen = new Set<string>();

  receive(posts: Post[]): Post[] {
    const approved = posts.filter(post => post.status === 'APPROVED');
    const fresh = approved.filter(post => !this.seen.has(post.id));
    approved.forEach(post => this.seen.add(post.id));
    if (!this.initialized) { this.initialized = true; return []; }
    return fresh.filter(post => post.status === 'APPROVED' && post.photoUrl && !esVideo(post.photoUrl)).reverse();
  }
}
