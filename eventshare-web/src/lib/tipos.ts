export type User = { id: string; name: string; role: 'ADMIN' | 'GUEST'; email: string | null; avatarUrl: string | null };

export type PublicEvent = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  primaryColor: string;
  eventDate: string | null;
  status: 'ACTIVE' | 'CLOSED' | 'ARCHIVED';
  moderationEnabled: boolean;
  url: string;
};

export type Author = { id: string; name: string; avatarUrl: string | null };

export type Post = {
  id: string;
  eventId: string;
  photoUrl: string | null;
  message: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  likesCount: number;
  commentsCount: number;
  createdAt: string;
  likedByMe: boolean;
  author: Author;
};

export type Comment = { id: string; postId: string; message: string; createdAt: string; author: Author };
export type Page<T> = { items: T[]; nextCursor: string | null };
