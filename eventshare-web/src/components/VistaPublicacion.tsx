'use client';

import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { Post, PublicEvent } from '@/lib/tipos';
import CommentSection from './SeccionComentarios';
import PostCard from './TarjetaPublicacion';

export default function PostView({ event, postId }: { event: PublicEvent; postId: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ post: Post }>(`/posts/${postId}`).then((r) => setPost(r.post)).catch((e) => setError(errorMessage(e)));
  }, [postId]);

  if (error) return <p role="alert" className="py-16 text-center text-muted">{error}</p>;
  if (!post) return <p role="status" className="py-16 text-center text-sm text-muted">Cargando…</p>;
  return (
    <>
      <PostCard post={post} code={event.code} readOnly={event.status !== 'ACTIVE'} />
      <CommentSection postId={post.id} code={event.code} closed={event.status !== 'ACTIVE'} />
    </>
  );
}
