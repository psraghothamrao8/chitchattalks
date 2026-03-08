import localforage from 'localforage';
import type { ChatMessage } from './types';

const messageStore = localforage.createInstance({
  name: 'ChitChatTalks',
  storeName: 'messages'
});

export const saveMessage = async (sessionId: string, message: ChatMessage) => {
  const currentMessages = await getMessages(sessionId);
  currentMessages.push(message);
  await messageStore.setItem(sessionId, currentMessages);
};

export const getMessages = async (sessionId: string): Promise<ChatMessage[]> => {
  const messages = await messageStore.getItem<ChatMessage[]>(sessionId);
  return messages || [];
};

export const clearSession = async (sessionId: string) => {
  await messageStore.removeItem(sessionId);
};
