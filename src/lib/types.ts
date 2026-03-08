export type MessageType = 'text' | 'image' | 'video' | 'file';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  type: MessageType;
  content: string | ArrayBuffer;
  fileName?: string;
  fileType?: string;
  timestamp: number;
}
