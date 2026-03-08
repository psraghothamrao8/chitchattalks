import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { Send, Paperclip, File as FileIcon, MessageCircle, ChevronLeft } from 'lucide-react';
import type { ChatMessage, MessageType } from './lib/types';
import { saveMessage, getMessages } from './lib/storage';
import './App.css'; // Just clean up the default

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
      setError('Please enter your name');
      return;
    }
    setIsConnecting(true);
    setError('');
    
    // Use custom code if provided, otherwise generate one
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

    newPeer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        setError('Session code already in use. Try another.');
      } else {
        setError('Failed to create: ' + err.message);
      }
      setIsConnecting(false);
    });
  };

  const handleJoinSession = () => {
    if (!userName.trim() || !sessionCode.trim()) {
      setError('Enter name and session code');
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

      conn.on('error', (err) => {
        setError('Connection failed: ' + err.message);
        setIsConnecting(false);
      });
    });

    newPeer.on('error', (err) => {
      setError('Error: ' + err.message);
      setIsConnecting(false);
    });
  };

  const setupConnectionListeners = async (conn: DataConnection, currentSession: string) => {
    const history = await getMessages(currentSession);
    setMessages(history);

    conn.on('data', async (data: any) => {
      if (data && data.type && data.content) {
        const message: ChatMessage = {
          ...data,
          timestamp: data.timestamp || Date.now()
        };
        setMessages((prev) => [...prev, message]);
        await saveMessage(currentSession, message);
      }
    });

    conn.on('close', () => {
      setError('Peer disconnected');
      setConnection(null);
    });
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
    await saveMessage(sessionCode.toUpperCase() || 'default', message);
    
    if (type === 'text') {
      setInputValue('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      let type: MessageType = 'file';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';

      await sendMessage(type, buffer, file.name, file.type);
    };
    reader.readAsArrayBuffer(file);
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const leaveSession = () => {
    if (connection) connection.close();
    if (peer) peer.destroy();
    setConnection(null);
    setPeer(null);
    setMessages([]);
    setSessionCode('');
    setView('home');
  };

  const renderMessageContent = (msg: ChatMessage) => {
    if (msg.type === 'text') {
      return <span>{msg.content as string}</span>;
    }

    if (typeof msg.content !== 'string') {
       const blob = new Blob([msg.content], { type: msg.fileType });
       const url = URL.createObjectURL(blob);
       
       if (msg.type === 'image') {
         return <img src={url} alt={msg.fileName} className="message-media" />;
       }
       if (msg.type === 'video') {
         return <video src={url} controls className="message-media" />;
       }
       return (
         <a href={url} download={msg.fileName} className="message-file">
           <FileIcon size={18} />
           <span>{msg.fileName}</span>
         </a>
       );
    }
    
    return <span>Unsupported format</span>;
  };

  return (
    <div className="app-container">
      {view === 'home' ? (
        <div className="home-container">
          <div className="home-card glass">
            <div className="home-header">
              <h1>ChitChat</h1>
              <p>Private & Encrypted P2P</p>
            </div>
            
            {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', backgroundColor: 'var(--primary-glow)', padding: '0.75rem', borderRadius: '12px', fontWeight: '600' }}>{error}</div>}

            <div className="input-group">
              <label>Your Display Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="What should we call you?"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Session Code (Optional for new)</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Custom code or leave blank"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase', textAlign: 'center', fontSize: '1.1rem', letterSpacing: '0.1em', fontWeight: '800' }}
                maxLength={10}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button 
                className="btn-primary" 
                onClick={handleCreateSession}
                disabled={isConnecting || !userName.trim()}
                style={{ flex: 1 }}
              >
                {isConnecting ? 'Starting...' : 'Create Room'}
              </button>

              <button 
                className="btn-primary" 
                onClick={handleJoinSession}
                disabled={isConnecting || !userName.trim() || !sessionCode.trim()}
                style={{ flex: 1, background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
              >
                Join Room
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-container">
          <div className="chat-header glass">
            <div className="chat-header-info">
              <button className="back-btn" onClick={leaveSession} style={{ background: 'transparent' }}>
                <ChevronLeft size={28} />
              </button>
              <div className="header-text">
                <div className="header-title" style={{ fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
                  {connection ? 'Room Active' : 'Waiting...'}
                </div>
                <div 
                  className="session-badge" 
                  onClick={() => navigator.clipboard.writeText(sessionCode)}
                  style={{ opacity: 0.8 }}
                >
                  Code: <span style={{ fontWeight: '800', color: 'var(--primary)' }}>{sessionCode}</span>
                </div>
              </div>
            </div>
            <div className="status-indicator">
               <div className={`status-dot ${!connection ? 'disconnected' : ''}`}></div>
               {connection ? 'P2P Secure' : 'Offline'}
            </div>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', margin: 'auto', opacity: 0.4 }}>
                <MessageCircle size={64} style={{ marginBottom: '1rem' }} />
                <p style={{ fontWeight: '600' }}>Encryption keys generated.</p>
                <p style={{ fontSize: '0.8rem' }}>Share code to start chatting.</p>
              </div>
            )}
            {messages.map((msg, idx) => {
              const isMe = msg.senderId === peer?.id;
              const showSender = !isMe && (idx === 0 || messages[idx - 1].senderId !== msg.senderId);
              
              return (
                <div key={msg.id} className={`message-wrapper ${isMe ? 'me' : 'other'}`}>
                  {showSender && <div className="message-sender">{msg.senderName}</div>}
                  <div className="message-bubble">
                    {renderMessageContent(msg)}
                  </div>
                  <div className="message-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area glass" style={{ borderTop: '1px solid var(--border)', borderBottom: 'none' }}>
            <input 
              type="file" 
              className="hidden-file-input" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            <div className="input-container" style={{ borderRadius: '20px' }}>
              <button 
                className="attach-btn" 
                onClick={() => fileInputRef.current?.click()}
                disabled={!connection}
              >
                <Paperclip size={22} />
              </button>
              <input 
                type="text" 
                className="chat-input"
                placeholder="Secure message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage('text', inputValue)}
                disabled={!connection}
                autoComplete="off"
              />
            </div>
            
            <button 
              className="send-btn" 
              onClick={() => sendMessage('text', inputValue)}
              disabled={!connection || !inputValue.trim()}
            >
              <Send size={20} color="white" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
