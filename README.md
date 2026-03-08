# ChitChat: Secure, Decentralized P2P Messaging

ChitChat is a production-ready, serverless messaging application designed for absolute privacy. It leverages **WebRTC** for direct peer-to-peer communication and **IndexedDB** for localized data persistence, ensuring that your conversations never touch a central server or database.

[![Deployment Status](https://github.com/psraghothamrao8/chitchattalks/actions/workflows/deploy.yml/badge.svg)](https://github.com/psraghothamrao8/chitchattalks/actions/workflows/deploy.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](http://creativecommons.org/licenses/by-nc-sa/4.0/)

---

## 🚀 Key Features

-   **End-to-End Encryption**: Native WebRTC DTLS encryption for all data channels (text, images, and files).
-   **Zero-Server Architecture**: No backend, no database, and no cloud storage. Communication happens directly between browsers.
-   **Bi-Directional History Sync**: Automatic merging of local histories when peers connect, ensuring consistent timelines for all participants.
-   **Dynamic Host Migration**: Intelligent failover logic that automatically promotes clients to "Host" status if the original creator leaves, keeping rooms active.
-   **Stunning Modern UI**: A minimalistic, high-fidelity interface featuring glassmorphism, fluid animations, and a mobile-first design.
-   **Binary File Support**: High-performance sharing of images and files (up to 15MB) with automatic memory management.
-   **Local Persistence**: All chat data is stored strictly on your physical device via IndexedDB.

---

## 🛠 Tech Stack

-   **Frontend**: React 19 (TypeScript)
-   **Networking**: PeerJS (WebRTC Abstraction)
-   **Storage**: LocalForage (IndexedDB API)
-   **Icons**: Lucide React
-   **Styling**: Modern CSS3 (Variables, 100dvh, Backdrop-filter)
-   **Build Tool**: Vite

---

## 📖 How It Works

1.  **Enter a Name**: Provide a display name for the session.
2.  **Room Code**: Enter a custom alphanumeric code or leave it blank to generate a random 8-character ID.
3.  **Connect**: Click **Enter Room**.
4.  **Share**: Give your Room Code to a friend. Once they join, a secure P2P tunnel is established.
5.  **Wipe**: At any point, any user can click the **Wipe** button to broadcast a deletion signal that clears the history from *everyone's* local storage.

For a deep technical dive into the networking and synchronization algorithms, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## 💻 Local Development

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/psraghothamrao8/chitchattalks.git
    cd chitchattalks
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Start the development server**:
    ```bash
    npm run dev
    ```

4.  **Build for production**:
    ```bash
    npm run build
    ```

---

## 📜 License & Copyright

This project is copyrighted by **psraghothamrao8** and is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** license.

-   **Personal Use**: You are free to share and adapt the code for non-commercial purposes.
-   **Commercial Use**: You **may NOT** use this software or its derivatives for business, resale, or monetization without express written permission.

---
*Built with privacy as a human right.*
