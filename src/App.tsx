import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { LogIn, Send, Paperclip, File as FileIcon, Copy, LogOut, MessageCircle, ChevronLeft } from 'lucide-react';
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
    
    const newSessionCode = generateId();
    const peerId = `chitchat-${newSessionCode}`;
    
    const newPeer = new Peer(peerId);
    
    newPeer.on('open', () => {
      setSessionCode(newSessionCode);
      setPeer(newPeer);
      setView('chat');
      setIsConnecting(false);
    });

    newPeer.on('connection', (conn) => {
      setConnection(conn);
      setupConnectionListeners(conn, newSessionCode);
    });

    newPeer.on('error', (err) => {
      setError('Failed to create: ' + err.message);
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
          <div className="home-card">
            <div className="home-header">
              <h1><MessageCircle size={28} color="var(--primary)" /> ChitChat</h1>
              <p>Secure peer-to-peer messaging</p>
            </div>
            
            {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', backgroundColor: '#fef2f2', padding: '0.5rem', borderRadius: '8px' }}>{error}</div>}

            <div className="input-group">
              <label>Your Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="E.g. Alex"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSession()}
              />
            </div>

            <button 
              className="btn-primary" 
              onClick={handleCreateSession}
              disabled={isConnecting || !userName.trim()}
            >
              <LogIn size={18} />
              {isConnecting ? 'Connecting...' : 'New Session'}
            </button>

            <div className="divider">OR JOIN</div>

            <div className="input-group">
              <label>Session Code</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Enter 6-digit code"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }}
                maxLength={6}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
              />
            </div>

            <button 
              className="btn-secondary" 
              onClick={handleJoinSession}
              disabled={isConnecting || !userName.trim() || !sessionCode.trim()}
            >
              Join Session
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-info">
              <button className="back-btn" onClick={leaveSession} title="Leave">
                <ChevronLeft size={24} />
              </button>
              <div className="header-text">
                <div className="header-title">
                  {connection ? 'Connected' : 'Waiting...'}
                  <div className={`status-dot ${!connection ? 'disconnected' : ''}`}></div>
                </div>
                <div 
                  className="session-badge" 
                  onClick={() => navigator.clipboard.writeText(sessionCode)}
                  title="Copy code"
                >
                  Code: <strong>{sessionCode}</strong> <Copy size={12} />
                </div>
              </div>
            </div>
            <button className="back-btn" onClick={leaveSession} title="Disconnect" style={{ color: '#ef4444' }}>
              <LogOut size={20} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '2rem', fontSize: '0.9rem' }}>
                <MessageCircle size={32} style={{ opacity: 0.5, marginBottom: '0.5rem' }} />
                <p>No messages yet.</p>
                {!connection && <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Share code <b>{sessionCode}</b> with a friend.</p>}
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

          <div className="chat-input-area">
            <input 
              type="file" 
              className="hidden-file-input" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            <div className="input-container">
              <button 
                className="attach-btn" 
                onClick={() => fileInputRef.current?.click()}
                disabled={!connection}
                title="Attach"
              >
                <Paperclip size={20} />
              </button>
              <input 
                type="text" 
                className="chat-input"
                placeholder={connection ? "Message..." : "Waiting for peer..."}
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
              <Send size={18} style={{ marginLeft: '2px' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
