import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { Send, Paperclip, File as FileIcon, ChevronLeft, Copy } from 'lucide-react';
import type { ChatMessage, MessageType } from './lib/types';
import { saveMessage, getMessages } from './lib/storage';
import localforage from 'localforage';
import './index.css';

const generateId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

function App() {
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [userName, setUserName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connections, setConnections] = useState<DataConnection[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Main Entry Point: Connect to a Room
  const startSession = async (code: string, asHost: boolean) => {
    setIsConnecting(true);
    setError('');
    const cleanCode = code.toUpperCase();
    const hostPeerId = `chitchat-${cleanCode}`;
    
    // Cleanup old peer if exists
    if (peer) peer.destroy();

    const newPeer = asHost ? new Peer(hostPeerId) : new Peer();
    
    newPeer.on('open', () => {
      setPeer(newPeer);
      setSessionCode(cleanCode);
      setView('chat');
      setIsConnecting(false);
      setIsHost(asHost);

      if (!asHost) {
        // I am a client, connect to the host
        const conn = newPeer.connect(hostPeerId, { reliable: true });
        setupConnection(conn);
      }
    });

    newPeer.on('connection', (conn) => {
      // Host receives a connection
      setupConnection(conn);
    });

    newPeer.on('error', (err) => {
      if (asHost && err.type === 'unavailable-id') {
        // Host ID taken, try joining as client instead
        startSession(cleanCode, false);
      } else {
        setError('Connection error: ' + err.type);
        setIsConnecting(false);
      }
    });
  };

  const setupConnection = (conn: DataConnection) => {
    conn.on('open', async () => {
      setConnections(prev => [...prev, conn]);
      
      // Load history and sync with the new peer
      const history = await getMessages(sessionCode);
      setMessages(history);
      
      // Send our history to them so they can merge
      conn.send({ type: 'sync-request', content: history });
    });

    conn.on('data', async (data: any) => {
      if (!data) return;

      if (data.type === 'sync-request') {
        // Peer sent their history, merge with ours
        const incoming = data.content as ChatMessage[];
        setMessages(prev => mergeMessages(prev, incoming));
        // Save merged to local
        for (const m of incoming) await saveMessage(sessionCode, m);
      } else if (data.type === 'delete-room') {
        await localforage.createInstance({ name: 'ChitChatTalks', storeName: 'messages' }).removeItem(sessionCode);
        setMessages([]);
        exitToHome();
      } else if (data.type) {
        // Standard message
        setMessages(prev => mergeMessages(prev, [data]));
        await saveMessage(sessionCode, data);
      }
    });

    conn.on('close', () => {
      setConnections(prev => prev.filter(c => c.peer !== conn.peer));
      // If host left, client tries to become the new host
      if (!isHost) {
        startSession(sessionCode, true);
      }
    });
  };

  const mergeMessages = (existing: ChatMessage[], incoming: ChatMessage[]) => {
    const map = new Map();
    existing.forEach(m => map.set(m.id, m));
    incoming.forEach(m => map.set(m.id, m));
    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  };

  const sendMessage = async (type: MessageType, content: string | ArrayBuffer, fileName?: string, fileType?: string) => {
    const message: ChatMessage = {
      id: Math.random().toString(36).substring(2, 12),
      senderId: peer?.id || 'me',
      senderName: userName,
      type,
      content,
      fileName,
      fileType,
      timestamp: Date.now()
    };

    connections.forEach(conn => conn.send(message));
    setMessages(prev => [...prev, message]);
    await saveMessage(sessionCode, message);
    if (type === 'text') setInputValue('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      let type: MessageType = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      sendMessage(type, buffer, file.name, file.type);
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const deleteRoom = async () => {
    if (!window.confirm('Delete all data for EVERYONE?')) return;
    connections.forEach(c => c.send({ type: 'delete-room' }));
    await localforage.createInstance({ name: 'ChitChatTalks', storeName: 'messages' }).removeItem(sessionCode);
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

  const renderContent = (msg: ChatMessage) => {
    if (msg.type === 'text') return <span>{msg.content as string}</span>;
    const blob = new Blob([msg.content], { type: msg.fileType });
    const url = URL.createObjectURL(blob);
    if (msg.type === 'image') return <img src={url} className="media-content" alt="" />;
    return <a href={url} download={msg.fileName} className="action-icon" style={{fontSize:'0.85rem'}}><FileIcon size={16} /> {msg.fileName}</a>;
  };

  return (
    <div className="app-wrapper">
      {view === 'home' ? (
        <div className="home-screen">
          <div className="home-content">
            <div className="brand">
              <h1>ChitChat</h1>
              <p>Peer-to-Peer & Secure</p>
            </div>
            {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', fontWeight: '700' }}>{error}</div>}
            <div className="form-group">
              <div className="input-container">
                <label>Display Name</label>
                <input className="base-input" placeholder="Your name" value={userName} onChange={e => setUserName(e.target.value)} />
              </div>
              <div className="input-container">
                <label>Room Code</label>
                <input className="base-input" placeholder="CODE" value={sessionCode} onChange={e => setSessionCode(e.target.value.toUpperCase())} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => startSession(sessionCode || generateId(), true)} disabled={isConnecting || !userName.trim()}>
              {isConnecting ? 'Connecting...' : 'Enter Room'}
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-view">
          <div className="chat-nav">
            <div className="nav-left">
              <button className="action-icon" onClick={exitToHome}><ChevronLeft size={24} /></button>
              <div className="room-info">
                <h2>{connections.length > 0 ? `${connections.length + 1} Online` : 'Waiting for peers...'}</h2>
                <p onClick={() => navigator.clipboard.writeText(sessionCode)}>CODE: {sessionCode} <Copy size={10} /></p>
              </div>
            </div>
            <button className="btn btn-secondary" style={{ height: '2.2rem', padding: '0 0.8rem', fontSize: '0.75rem', color: '#ef4444', borderColor: '#ef4444' }} onClick={deleteRoom}>Delete</button>
          </div>
          <div className="msg-container">
            {messages.map((msg, i) => {
              const isMe = msg.senderId === peer?.id;
              return (
                <div key={msg.id} className={`msg-row ${isMe ? 'me' : 'other'}`}>
                  {!isMe && (i === 0 || messages[i-1].senderId !== msg.senderId) && <div className="msg-meta">{msg.senderName}</div>}
                  <div className="msg-bubble">{renderContent(msg)}</div>
                  <div className="msg-meta">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          <div className="input-footer">
            <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
            <button className="action-icon" onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
            <input className="msg-input-field" placeholder="Message..." value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage('text', inputValue)} />
            <button className="action-icon" style={{ color: 'var(--primary)' }} onClick={() => sendMessage('text', inputValue)} disabled={!inputValue.trim()}><Send size={20} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
