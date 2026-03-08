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

    newPeer.on('error', (err) => {
      if (err.type === 'unavailable-id') {
        setError('Code in use');
      } else {
        setError('Error: ' + err.message);
      }
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

      conn.on('error', (err) => {
        setError('Fail: ' + err.message);
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
      if (data && data.type) {
        setMessages((prev) => [...prev, data]);
        await saveMessage(currentSession, data);
      }
    });

    conn.on('close', () => {
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
    
    if (msg.type === 'image') return <img src={url} className="media-img" alt="" />;
    return (
      <a href={url} download={msg.fileName} className="file-link">
        <FileIcon size={16} /> {msg.fileName}
      </a>
    );
  };

  return (
    <div className="app-container">
      {view === 'home' ? (
        <div className="home-container">
          <div className="home-card">
            <div className="home-header">
              <h1>ChitChat</h1>
              <p>Secure Peer-to-Peer Messaging</p>
            </div>

            {error && <div style={{ color: 'red', fontSize: '13px', textAlign: 'center' }}>{error}</div>}

            <div className="input-group">
              <label>NAME</label>
              <input 
                className="input-field" 
                placeholder="Enter your name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>SESSION CODE (OPTIONAL FOR NEW)</label>
              <input 
                className="input-field" 
                placeholder="ABCXYZ"
                value={sessionCode}
                onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              />
            </div>

            <div className="button-row">
              <button className="btn btn-primary" onClick={handleCreateSession} disabled={isConnecting}>
                {isConnecting ? '...' : 'Create Room'}
              </button>
              <button className="btn btn-secondary" onClick={handleJoinSession} disabled={isConnecting}>
                Join Room
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="chat-container">
          <div className="chat-header">
            <div className="header-left">
              <button className="icon-btn" onClick={() => setView('home')}><ChevronLeft size={20} /></button>
              <div className="session-info">
                <span>{connection ? 'Connected' : 'Waiting...'}</span>
                <div className="session-code-badge" onClick={() => navigator.clipboard.writeText(sessionCode)}>
                  CODE: {sessionCode} <Copy size={10} />
                </div>
              </div>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((msg, i) => {
              const isMe = msg.senderId === peer?.id;
              return (
                <div key={msg.id} className={`message-wrap ${isMe ? 'me' : 'other'}`}>
                  {!isMe && (i === 0 || messages[i-1].senderId !== msg.senderId) && (
                    <div className="sender-name">{msg.senderName}</div>
                  )}
                  <div className="bubble">{renderContent(msg)}</div>
                  <div className="time">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area">
            <input type="file" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileUpload} />
            <button className="icon-btn" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={20} />
            </button>
            <input 
              className="input-box" 
              placeholder="Message..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage('text', inputValue)}
              disabled={!connection}
            />
            <button className="icon-btn" style={{ color: 'var(--primary)' }} onClick={() => sendMessage('text', inputValue)} disabled={!connection}>
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
