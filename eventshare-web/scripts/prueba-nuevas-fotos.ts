import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NewPhotoTracker } from '../src/lib/nuevasFotos';
import type { Post } from '../src/lib/tipos';
const photo = (id: string, changes: Partial<Post> = {}): Post => ({ id, eventId: 'event', photoUrl: '/foto.jpg', message: null, status: 'APPROVED', likesCount: 0, commentsCount: 0, createdAt: '', likedByMe: false, author: { id: 'guest', name: 'Invitado', avatarUrl: null }, ...changes });
test('no anuncia la colección inicial ni repite fotos en sondeos posteriores', () => {
  const tracker = new NewPhotoTracker();
  assert.deepEqual(tracker.receive([photo('old')]), []);
  assert.deepEqual(tracker.receive([photo('newer'), photo('new'), photo('old')]).map(p => p.id), ['new', 'newer']);
  assert.deepEqual(tracker.receive([photo('newer'), photo('new')]), []);
  tracker.receive([]);
  assert.deepEqual(tracker.receive([photo('old')]), []);
});
test('un evento vacío anuncia su primera foto y solo se muestran fotos aprobadas', () => {
  const tracker = new NewPhotoTracker();
  tracker.receive([]);
  assert.deepEqual(tracker.receive([photo('pending', { status: 'PENDING' }), photo('video', { photoUrl: '/video.mp4' }), photo('text', { photoUrl: null })]), []);
  assert.deepEqual(tracker.receive([photo('pending')]).map(p => p.id), ['pending']);
});
