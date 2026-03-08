import { useState, useEffect, useRef, memo } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { Send, Paperclip, File as FileIcon, ChevronLeft, Copy, AlertCircle, Loader2 } from 'lucide-react';
import type { ChatMessage, MessageType } from './lib/types';
import { saveMessage, getMessages } from './lib/storage';
import localforage from 'localforage';
import './index.css';

const generateId = () => Math.random().toString(36).substring(2, 10).toUpperCase();
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB limit for stable P2P transfer

// --- Sub-components for better performance and memory management ---

const MediaMessage = memo(({ msg }: { msg: ChatMessage }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof msg.content !== 'string') {
      const blob = new Blob([msg.content], { type: msg.fileType });
      const generatedUrl = URL.createObjectURL(blob);
      setUrl(generatedUrl);
      return () => URL.revokeObjectURL(generatedUrl);
    }
  }, [msg.content, msg.fileType]);

  if (!url) return <div className="loading-placeholder"><Loader2 className="animate-spin" size={16} /></div>;

  if (msg.type === 'image') {
    return <img src={url} className="media-content" alt={msg.fileName} loading="lazy" />;
  }
  
  return (
    <a href={url} download={msg.fileName} className="file-link-box">
      <FileIcon size={18} />
      <div className="file-info">
        <span className="file-name">{msg.fileName}</span>
        <span className="file-size">Click to download</span>
      </div>
    </a>
  );
});

// --- Main Application ---

function App() {
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [userName, setUserName] = useState(() => localStorage.getItem('chat-name') || '');
  const [sessionCode, setSessionCode] = useState('');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [isSendingFile, setIsSendingFile] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userName) localStorage.setItem('chat-name', userName);
  }, [userName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startSession = async (code: string, asHost: boolean) => {
    if (!userName.trim()) {
      setError('Name is required');
      return;
    }
    
    setIsConnecting(true);
    setError('');
    const cleanCode = code.toUpperCase();
    const hostPeerId = `chitchat-${cleanCode}`;
    
    if (peer) peer.destroy();

    const newPeer = asHost ? new Peer(hostPeerId) : new Peer();
    
    newPeer.on('open', () => {
      setPeer(newPeer);
      setSessionCode(cleanCode);
      setView('chat');
      setIsConnecting(false);
      setIsHost(asHost);

      if (!asHost) {
        const conn = newPeer.connect(hostPeerId, { reliable: true });
        setupConnection(conn);
      }
    });

    newPeer.on('connection', (conn) => {
      setupConnection(conn);
    });

    newPeer.on('error', (err) => {
      console.error('Peer Error:', err.type);
      if (asHost && err.type === 'unavailable-id') {
        startSession(cleanCode, false);
      } else {
        setError(`Error: ${err.type}`);
        setIsConnecting(false);
      }
    });

    newPeer.on('disconnected', () => newPeer.reconnect());
  };

  const setupConnection = (conn: DataConnection) => {
    conn.on('open', async () => {
      // Avoid duplicate connections
      setConnections(prev => {
        if (prev.find(c => c.peer === conn.peer)) return prev;
        return [...prev, conn];
      });
      
      const history = await getMessages(sessionCode);
      setMessages(prev => mergeMessages(prev, history));
      conn.send({ type: 'sync-request', content: history });
    });

    conn.on('data', async (data: any) => {
      if (!data) return;

      if (data.type === 'sync-request') {
        const incoming = data.content as ChatMessage[];
        setMessages(prev => mergeMessages(prev, incoming));
        for (const m of incoming) await saveMessage(sessionCode, m);
      } else if (data.type === 'delete-room') {
        await localforage.createInstance({ name: 'ChitChatTalksTalks', storeName: 'messages' }).removeItem(sessionCode);
        setMessages([]);
        exitToHome();
      } else if (data.type) {
        setMessages(prev => mergeMessages(prev, [data]));
        await saveMessage(sessionCode, data);
      }
    });

    conn.on('close', () => {
      setConnections(prev => {
        const next = prev.filter(c => c.peer !== conn.peer);
        // If we are a client and our only connection (to the host) closed
        // we try to become the new host for this room code.
        if (!isHost && next.length === 0 && view === 'chat') {
          setTimeout(() => startSession(sessionCode, true), 1000);
        }
        return next;
      });
    });
  };

  const mergeMessages = (existing: ChatMessage[], incoming: ChatMessage[]) => {
    const map = new Map();
    existing.forEach(m => map.set(m.id, m));
    incoming.forEach(m => map.set(m.id, m));
    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  };

  const sendMessage = async (type: MessageType, content: string | ArrayBuffer, fileName?: string, fileType?: string) => {
    if (!peer) return;
    
    const message: ChatMessage = {
      id: `${peer.id}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      senderId: peer.id,
      senderName: userName,
      type,
      content,
      fileName,
      fileType,
      timestamp: Date.now()
    };

    connections.forEach(conn => {
      if (conn.open) conn.send(message);
    });
    
    setMessages(prev => [...prev, message]);
    await saveMessage(sessionCode, message);
    if (type === 'text') setInputValue('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Max 15MB for stable P2P transfer.');
      return;
    }

    setIsSendingFile(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      let type: MessageType = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      
      await sendMessage(type, buffer, file.name, file.type);
      setIsSendingFile(false);
    };
    reader.onerror = () => {
      alert('Failed to read file');
      setIsSendingFile(false);
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteRoom = async () => {
    if (!window.confirm('WIPE ALL DATA for everyone in this room?')) return;
    connections.forEach(c => {
      if (c.open) c.send({ type: 'delete-room' });
    });
    await localforage.createInstance({ name: 'ChitChatTalksTalks', storeName: 'messages' }).removeItem(sessionCode);
    exitToHome();
  };

  const exitToHome = () => {
    connections.forEach(c => c.close());
    if (peer) peer.destroy();
    setPeer(null);
    setConnections([]);
    setMessages([]);
    setView('home');
  };

  return (
    <div className="app-wrapper">
      {view === 'home' ? (
        <div className="home-screen">
          <div className="home-content">
            <div className="brand">
              <h1>ChitChatTalks</h1>
              <p>End-to-End P2P Messaging</p>
            </div>
            
            {error && (
              <div className="error-pill">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <div className="form-group">
              <div className="input-container">
                <label>Display Name</label>
                <input 
                  className="base-input" 
                  placeholder="E.g. Alex" 
                  value={userName} 
                  onChange={e => setUserName(e.target.value)} 
                  maxLength={20}
                />
              </div>
              <div className="input-container">
                <label>Room Code</label>
                <input 
                  className="base-input" 
                  placeholder="Optional Code" 
                  value={sessionCode} 
                  onChange={e => setSessionCode(e.target.value.toUpperCase())} 
                  maxLength={12}
                />
              </div>
            </div>
            
            <button 
              className="btn btn-primary" 
              onClick={() => startSession(sessionCode || generateId(), true)} 
              disabled={isConnecting || !userName.trim()}
            >
              {isConnecting ? <Loader2 className="animate-spin" size={20} /> : 'Enter Room'}
            </button>
            <p className="privacy-note">Messages are stored only on your device.</p>
          </div>
        </div>
      ) : (
        <div className="chat-view">
          <div className="chat-nav">
            <div className="nav-left">
              <button className="action-icon" onClick={exitToHome}><ChevronLeft size={24} /></button>
              <div className="room-info">
                <h2>{connections.length > 0 ? `${connections.length + 1} Online` : 'Securing Room...'}</h2>
                <div className="code-pill" onClick={() => {
                  navigator.clipboard.writeText(sessionCode);
                  alert('Code copied!');
                }}>
                  {sessionCode} <Copy size={10} />
                </div>
              </div>
            </div>
            <button className="delete-btn" onClick={deleteRoom}>Wipe</button>
          </div>

          <div className="msg-container">
            {messages.length === 0 && (
              <div className="empty-state">
                <Paperclip size={40} />
                <p>Room is empty. Share the code to start.</p>
              </div>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.senderId === peer?.id;
              const showName = !isMe && (i === 0 || messages[i-1].senderId !== msg.senderId);
              return (
                <div key={msg.id} className={`msg-row ${isMe ? 'me' : 'other'}`}>
                  {showName && <div className="msg-meta-name">{msg.senderName}</div>}
                  <div className="msg-bubble">
                    {msg.type === 'text' ? (
                      <span>{msg.content as string}</span>
                    ) : (
                      <MediaMessage msg={msg} />
                    )}
                  </div>
                  <div className="msg-meta-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-footer">
            <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
            <button 
              className="action-icon" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isSendingFile}
            >
              {isSendingFile ? <Loader2 className="animate-spin" size={20} /> : <Paperclip size={20} />}
            </button>
            <input 
              className="msg-input-field" 
              placeholder="Type message..." 
              value={inputValue} 
              onChange={e => setInputValue(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && inputValue.trim() && sendMessage('text', inputValue)}
              autoComplete="off"
            />
            <button 
              className="action-icon-send" 
              onClick={() => sendMessage('text', inputValue)} 
              disabled={!inputValue.trim() || isSendingFile}
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
