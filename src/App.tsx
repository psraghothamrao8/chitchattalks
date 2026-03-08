import { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { LogIn, Send, Paperclip, File as FileIcon, Copy, LogOut } from 'lucide-react';
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
      setError('Failed to create session: ' + err.message);
      setIsConnecting(false);
    });
  };

  const handleJoinSession = () => {
    if (!userName.trim() || !sessionCode.trim()) {
      setError('Please enter your name and a session code');
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
        setError('Failed to connect: ' + err.message);
        setIsConnecting(false);
      });
    });

    newPeer.on('error', (err) => {
      setError('Connection error: ' + err.message);
      setIsConnecting(false);
    });
  };

  const setupConnectionListeners = async (conn: DataConnection, currentSession: string) => {
    // Load history
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
      setError('Connection closed by peer');
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
           <FileIcon size={20} />
           <span>{msg.fileName}</span>
         </a>
       );
    }
    
    return <span>Unsupported message format</span>;
  };

  return (
    <div className="app-container">
      {view === 'home' ? (
        <div className="home-container">
          <div className="home-card">
            <h1>ChitChatTalks</h1>
            <p>End-to-end encrypted P2P communication</p>
            
            {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

            <div className="input-group">
              <label>Your Name</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>

            <button 
              className="btn-primary" 
              onClick={handleCreateSession}
              disabled={isConnecting}
            >
              <LogIn size={20} />
              {isConnecting ? 'Creating...' : 'Create New Session'}
            </button>

            <div className="divider">OR</div>

            <div className="input-group">
              <label>Session Code</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Enter session code to join"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
              />
            </div>

            <button 
              className="btn-secondary" 
              onClick={handleJoinSession}
              disabled={isConnecting}
            >
              Join Session
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-info">
              <button className="icon-btn" onClick={leaveSession} title="Leave Session">
                <LogOut size={20} />
              </button>
              <div>
                <div style={{ fontWeight: 600 }}>{connection ? 'Connected' : 'Waiting for peer...'}</div>
                <div 
                  className="session-code" 
                  onClick={() => navigator.clipboard.writeText(sessionCode)}
                  title="Click to copy"
                >
                  Code: {sessionCode} <Copy size={12} style={{ display: 'inline', marginLeft: '4px' }} />
                </div>
              </div>
            </div>
            <div className={`status-dot ${!connection ? 'disconnected' : ''}`} title={connection ? 'Connected' : 'Waiting'}></div>
          </div>

          <div className="chat-messages">
            {messages.map((msg) => {
              const isMe = msg.senderId === peer?.id;
              return (
                <div key={msg.id} className={`message-wrapper ${isMe ? 'me' : 'other'}`}>
                  <div className="message-sender">{isMe ? 'You' : msg.senderName}</div>
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
            <button 
              className="icon-btn" 
              onClick={() => fileInputRef.current?.click()}
              disabled={!connection}
              title="Attach File"
            >
              <Paperclip size={20} />
            </button>
            <input 
              type="text" 
              className="chat-input"
              placeholder="Type a message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage('text', inputValue)}
              disabled={!connection}
            />
            <button 
              className="send-btn" 
              onClick={() => sendMessage('text', inputValue)}
              disabled={!connection || !inputValue.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
