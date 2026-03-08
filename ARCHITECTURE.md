# ChitChat: Engineering a Decentralized P2P Messaging Platform

This guide provides a comprehensive technical breakdown of ChitChat's architecture. It is designed for software engineers and students to understand the mechanics of WebRTC, decentralized state management, and high-performance React patterns.

---

## 1. High-Level Architectural Philosophy

ChitChat is built on the principle of **Zero-Knowledge Decentralization**. Traditional chat apps use a Client-Server model (User -> Server -> Database -> User). ChitChat eliminates the middleman.

### The Network Topology
ChitChat uses a **Dynamic Mesh Topology**:
*   **The Room ID:** A specific string (e.g., `chitchat-MYCODE`) acts as a virtual rendezvous point.
*   **The Host:** The first person to enter a room registers the "Host ID" on the signaling server.
*   **The Clients:** Subsequent users join as clients and connect directly to the Host.
*   **Failover:** If the Host leaves, clients detect the disconnection and the next available peer automatically "promotes" themselves to Host, ensuring the room remains active.

---

## 2. The Tech Stack & Why

| Technology | Role | Reason |
| :--- | :--- | :--- |
| **React 19** | UI Framework | Concurrent rendering and high-performance state updates. |
| **PeerJS** | P2P Networking | Abstracts complex WebRTC handshaking (ICE, STUN, TURN). |
| **LocalForage** | Local Database | Asynchronous wrapper for IndexedDB to store megabytes of message history locally. |
| **Lucide React** | Iconography | High-fidelity, consistent SVG icons. |
| **Modern CSS3** | Styling | Utilizes `100dvh` for mobile keyboard handling and `backdrop-filter` for glassmorphism. |

---

## 3. Core Implementation Pillars

### A. The "Smart Sync" Algorithm (Bi-Directional)
In a P2P environment, there is no central database to "fetch" history from.
1.  **Handshake:** When Peer A connects to Peer B, they immediately exchange a `sync-request` containing their full local histories.
2.  **Merging:** The receiver uses a `Map` based on `message.id` to merge incoming messages with existing ones.
3.  **Deduplication:** Since message IDs are unique (`peerId-timestamp-random`), the merge logic ensures no message is duplicated, even if both peers already had it.
4.  **Sorting:** The resulting array is sorted by `timestamp` to ensure a consistent timeline.

### B. Handling Binary Data (Images & Files)
WebRTC Data Channels support strings and binary buffers.
*   **Encoding:** We use `FileReader.readAsArrayBuffer()` to convert files into raw byte arrays.
*   **Transmission:** These arrays are sent directly over the wire.
*   **Decoding:** The receiver creates a `Blob` from the buffer and uses `URL.createObjectURL(blob)` to display it.
*   **Memory Management:** To prevent browser crashes, we use `URL.revokeObjectURL()` inside a React `useEffect` cleanup function to free up RAM once a message is unmounted.

### C. Host Migration & Recovery
This is the most complex part of the system.
*   **Heartbeat:** Peers monitor the `close` event of their connections.
*   **Promotion:** If a client loses its connection to the host, it waits 500ms and then attempts to register itself as the new Host using the room's specific ID.
*   **Availability:** If multiple clients are present, PeerJS's `unavailable-id` error logic ensures only one successfully becomes the new host, while the others remain clients.

---

## 4. Security & Privacy Model

1.  **Encryption:** WebRTC uses **DTLS (Datagram Transport Layer Security)** for all data channels. This is industry-standard encryption that protects against Man-in-the-Middle (MITM) attacks.
2.  **Signaling Privacy:** The signaling server (PeerJS Cloud) only facilitates the "discovery" phase. Once the connection is established, the signaling server is no longer involved.
3.  **Local Storage:** By using **IndexedDB** instead of `localStorage`, we can store large files (up to 15MB) and structured data without blocking the main UI thread.

---

## 5. UI/UX Engineering for Mobile

### The Keyboard Problem
On mobile, the virtual keyboard often covers the input field.
*   **Solution:** We use `height: 100dvh` (Dynamic Viewport Height). This unit automatically resizes when the browser UI or keyboard changes, ensuring the "Send" button is always reachable.

### Glassmorphism & Performance
*   **Aesthetics:** `backdrop-filter: blur(12px)` combined with semi-transparent backgrounds creates a premium "frosted glass" feel.
*   **Optimization:** We wrap message components in `React.memo` to prevent expensive re-renders of the entire chat list when only one new message arrives.

---

## 6. How to Extend This Project (Learner Exercises)

1.  **Group Chat Routing:** Currently, it's a hub-and-spoke model. Try implementing a full-mesh where every client connects to every other client.
2.  **Message Editing:** Add an `edit` type to the `ChatMessage` and implement logic to update existing IDs in the local storage.
3.  **Audio Messaging:** Use the `MediaRecorder` API to capture audio, send the buffer, and play it using the `<audio>` tag.

---
*Developed with focus on privacy, security, and performance. Documentation generated for the engineering community.*
