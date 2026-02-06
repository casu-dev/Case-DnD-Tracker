import { describe, it, expect } from 'vitest';
import { getRoomIdFromUrl, setRoomIdInUrl, clearRoomIdFromUrl } from './room-id.util';

describe('room-id.util', () => {
  describe('getRoomIdFromUrl', () => {
    it('should return null when no hash is present', () => {
      window.location.hash = '';
      expect(getRoomIdFromUrl()).toBeNull();
    });

    it('should return null when hash does not match format', () => {
      window.location.hash = '#invalid';
      expect(getRoomIdFromUrl()).toBeNull();
    });

    it('should extract room ID from v1 format', () => {
      window.location.hash = '#v1:test-room-id';
      expect(getRoomIdFromUrl()).toBe('test-room-id');
    });
  });

  describe('setRoomIdInUrl', () => {
    it('should set hash in v1 format', () => {
      setRoomIdInUrl('my-room');
      expect(window.location.hash).toBe('#v1:my-room');
    });
  });

  describe('clearRoomIdFromUrl', () => {
    it('should clear the hash', () => {
      window.location.hash = '#v1:test';
      clearRoomIdFromUrl();
      expect(window.location.hash).toBe('');
    });
  });
});
