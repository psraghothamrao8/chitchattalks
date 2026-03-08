import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { Send, Paperclip, File as FileIcon, ChevronLeft, Copy } from 'lucide-react';
import type { ChatMessage, MessageType } from './lib/types';
import { saveMessage, getMessages } from './lib/storage';
import './index.css';

const generateId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

function App() {
  const [view, setView] = useState<'home' | 'chat'>('home');
  const [userName, setUserName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connection, setConnection] = useState<DataConnection | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateSession = () => {
    if (!userName.trim()) {
      setError('Enter your name');
      return;
    }
    setIsConnecting(true);
    setError('');
    
    const codeToUse = sessionCode.trim() || generateId();
    const peerId = `chitchat-${codeToUse}`;
    const newPeer = new Peer(peerId);
    
    newPeer.on('open', () => {
      setSessionCode(codeToUse);
      setPeer(newPeer);
      setView('chat');
      setIsConnecting(false);
    });

    newPeer.on('connection', (conn) => {
      setConnection(conn);
      setupConnectionListeners(conn, codeToUse);
    });

    newPeer.on('error', (err: any) => {
      setError(err.type === 'unavailable-id' ? 'Code in use' : 'Error: ' + err.message);
      setIsConnecting(false);
    });
  };

  const handleJoinSession = () => {
    if (!userName.trim() || !sessionCode.trim()) {
      setError('Enter name and code');
      return;
    }
    setIsConnecting(true);
    setError('');

    const newPeer = new Peer();
    newPeer.on('open', () => {
      setPeer(newPeer);
      const conn = newPeer.connect(`chitchat-${sessionCode.toUpperCase()}`);
      
      conn.on('open', () => {
        setConnection(conn);
        setupConnectionListeners(conn, sessionCode.toUpperCase());
        setView('chat');
        setIsConnecting(false);
      });

      conn.on('error', () => {
        setError('Connection failed');
        setIsConnecting(false);
      });
    });

    newPeer.on('error', () => {
      setError('Peer error');
      setIsConnecting(false);
    });
  };

  const setupConnectionListeners = async (conn: DataConnection, currentSession: string) => {
    const history = await getMessages(currentSession);
    setMessages(history);

    conn.on('data', async (data: any) => {
      if (data && data.type) {
        setMessages((prev) => [...prev, data]);
        await saveMessage(currentSession, data);
      }
    });

    conn.on('close', () => setConnection(null));
  };

  const sendMessage = async (type: MessageType, content: string | ArrayBuffer, fileName?: string, fileType?: string) => {
    if (!connection || (!content && type === 'text')) return;

    const message: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      senderId: peer?.id || 'me',
      senderName: userName,
      type,
      content,
      fileName,
      fileType,
      timestamp: Date.now()
    };

    connection.send(message);
    setMessages((prev) => [...prev, message]);
    await saveMessage(sessionCode.toUpperCase(), message);
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
  };

  const renderContent = (msg: ChatMessage) => {
    if (msg.type === 'text') return msg.content as string;
    const blob = new Blob([msg.content], { type: msg.fileType });
    const url = URL.createObjectURL(blob);
    if (msg.type === 'image') return <img src={url} className="media-content" alt="" />;
    return (
      <a href={url} download={msg.fileName} className="action-icon" style={{ fontSize: '0.85rem' }}>
        <FileIcon size={16} /> {msg.fileName}
      </a>
    );
  };

  return (
    <div className="app-wrapper">
      {view === 'home' ? (
        <div className="home-screen">
          <div className="home-content">
            <div className="brand">
              <h1>ChitChat</h1>
              <p>Peer-to-Peer & Fully Encrypted</p>
            </div>

            {error && <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center', fontWeight: '600' }}>{error}</div>}

            <div className="form-group">
              <div className="input-container">
                <label>Display Name</label>
                <input 
                  className="base-input" 
                  placeholder="Your name"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                />
              </div>

              <div className="input-container">
                <label>Session Code</label>
                <input 
                  className="base-input" 
                  placeholder="CODE or leave blank"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="button-group">
              <button className="btn btn-primary" onClick={handleCreateSession} disabled={isConnecting}>
                {isConnecting ? '...' : 'Create'}
              </button>
              <button className="btn btn-secondary" onClick={handleJoinSession} disabled={isConnecting}>
                Join
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-view">
          <div className="chat-nav">
            <div className="nav-left">
              <button className="action-icon" onClick={() => setView('home')}><ChevronLeft size={24} /></button>
              <div className="room-info">
                <h2>{connection ? 'Connected' : 'Waiting...'}</h2>
                <p onClick={() => navigator.clipboard.writeText(sessionCode)}>CODE: {sessionCode} <Copy size={10} /></p>
              </div>
            </div>
          </div>

          <div className="msg-container">
            {messages.map((msg, i) => {
              const isMe = msg.senderId === peer?.id;
              return (
                <div key={msg.id} className={`msg-row ${isMe ? 'me' : 'other'}`}>
                  {!isMe && (i === 0 || messages[i-1].senderId !== msg.senderId) && (
                    <div className="msg-meta" style={{ marginBottom: '2px' }}>{msg.senderName}</div>
                  )}
                  <div className="msg-bubble">{renderContent(msg)}</div>
                  <div className="msg-meta">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-footer">
            <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
            <button className="action-icon" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={20} />
            </button>
            <input 
              className="msg-input-field" 
              placeholder="Message..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage('text', inputValue)}
              disabled={!connection}
            />
            <button className="action-icon" style={{ color: 'var(--primary)' }} onClick={() => sendMessage('text', inputValue)} disabled={!connection || !inputValue.trim()}>
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
