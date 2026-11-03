'use client';

export async function signOut(destination = '/login') {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } finally {
    window.location.assign(destination);
  }
}
