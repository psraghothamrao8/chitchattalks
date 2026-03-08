import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock PeerJS
class MockPeer {
  id = 'mock-id';
  on = vi.fn();
  connect = vi.fn();
  destroy = vi.fn();
}

vi.stubGlobal('Peer', MockPeer);

// Keep existing URL but mock the specific static methods needed
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'mock-url');
  window.URL.revokeObjectURL = vi.fn();
}

// Mock navigator.clipboard
vi.stubGlobal('navigator', {
  clipboard: {
    writeText: vi.fn(),
  },
});
