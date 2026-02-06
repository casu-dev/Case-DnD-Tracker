export function getRoomIdFromUrl(): string | null {
  const hash = window.location.hash;
  // The format is #v1:token-id
  if (hash && hash.startsWith('#v1:')) {
    return hash.substring(4);
  }
  return null;
}

export function setRoomIdInUrl(roomId: string): void {
  window.location.hash = `v1:${roomId}`;
}

export function clearRoomIdFromUrl(): void {
  // Clear the URL fragment without adding to history or reloading
  window.history.pushState('', document.title, window.location.pathname + window.location.search);
}
