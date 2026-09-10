# 🚀 Baileys Bot - Complete Features Guide

## ✨ Fitur Lengkap yang Tersedia

### 📨 Messaging Features
- ✅ **Send Text Messages** - Kirim pesan teks biasa
- ✅ **Send Images** - Kirim gambar dengan caption
- ✅ **Send Videos** - Kirim video dengan caption
- ✅ **Send Audio** - Kirim file audio/voice note
- ✅ **Send Documents** - Kirim file dokumen apapun
- ✅ **Send Location** - Kirim lokasi koordinat
- ✅ **Send Contact** - Kirim contact/vCard
- ✅ **Send Buttons** - Kirim pesan dengan tombol interaktif
- ✅ **Send List Messages** - Kirim menu/list pilihan
- ✅ **Send Polls** - Kirim polling/voting message
- ✅ **Quote Messages** - Reply dengan quote ke pesan lain
- ✅ **Revoke Messages** - Hapus pesan yang sudah terkirim

### 👥 Group Management
- ✅ **Create Groups** - Buat grup baru
- ✅ **Add Members** - Tambah anggota ke grup
- ✅ **Remove Members** - Keluarkan anggota dari grup
- ✅ **Promote to Admin** - Jadikan anggota sebagai admin
- ✅ **Demote from Admin** - Lepaskan admin status
- ✅ **Update Subject** - Ubah nama grup
- ✅ **Update Description** - Ubah deskripsi grup
- ✅ **Get Group Info** - Ambil informasi detail grup
- ✅ **Leave Group** - Bot keluar dari grup
- ✅ **Group Notifications** - Menerima notifikasi perubahan grup

### 👤 Profile & Contact Management
- ✅ **Get Profile Picture** - Ambil foto profil pengguna
- ✅ **Get User Status** - Ambil status pengguna
- ✅ **Update Profile Name** - Ubah nama bot
- ✅ **Update Profile Status** - Ubah status bot
- ✅ **Get All Contacts** - Ambil daftar semua kontak
- ✅ **Get All Chats** - Ambil daftar semua percakapan

### 🟢 Presence & Status
- ✅ **Typing Status** - Tampilkan status "sedang mengetik"
- ✅ **Recording Status** - Tampilkan status "sedang merekam"
- ✅ **Online Status** - Tampilkan status online
- ✅ **Presence Updates** - Menerima update status pengguna lain

### 🔔 Events & Notifications
- ✅ **Message Events** - Terima notifikasi pesan masuk
- ✅ **Message Updates** - Terima update status pesan (sent, delivered, read)
- ✅ **Delivery Receipts** - Konfirmasi pengiriman pesan
- ✅ **Read Receipts** - Konfirmasi pesan sudah dibaca
- ✅ **Call Events** - Menerima notifikasi panggilan
- ✅ **Group Updates** - Notifikasi perubahan grup
- ✅ **Contact Updates** - Notifikasi update kontak
- ✅ **Presence Updates** - Notifikasi status online/offline

### 💬 Chat Management
- ✅ **Mark as Read** - Tandai chat sebagai sudah dibaca
- ✅ **Delete Chat** - Hapus chat dari daftar
- ✅ **Mute Chat** - Senyapkan notifikasi chat
- ✅ **Archive Chat** - Arsipkan chat
- ✅ **Pin Chat** - Jadikan chat sebagai pinned

### 📱 Auto-Forward Feature
- ✅ **Auto-Forward to Channel** - Setiap pesan masuk otomatis diteruskan ke channel:
  - `https://whatsapp.com/channel/0029Vb9FLjYIN9im3Ip1Oj3p`
  - Format: Nama pengirim, jenis chat, waktu, dan isi pesan

### 🔐 Security & Connection
- ✅ **Multi-Device Support** - Support WhatsApp multi-device
- ✅ **QR Code Login** - Scan QR code untuk login
- ✅ **Session Management** - Otomatis simpan & restore session
- ✅ **Auto-Reconnect** - Otomatis reconnect jika terputus
- ✅ **Error Handling** - Error handling lengkap
- ✅ **Rate Limiting** - Proteksi dari rate limiting

### 📊 Media Handling
- ✅ **Image Processing** - Handle image download/upload
- ✅ **Video Processing** - Handle video download/upload
- ✅ **Audio Processing** - Handle audio download/upload
- ✅ **Document Processing** - Handle dokumen apapun
- ✅ **Auto Decryption** - Dekripsi media otomatis
- ✅ **Media Caching** - Cache media untuk performa
- ✅ **High Quality Links** - Generate preview link berkualitas tinggi

### 🛠️ Advanced Features
- ✅ **Message Logging** - Log semua pesan ke file
- ✅ **Error Logging** - Log semua error
- ✅ **Custom Logger** - Logger dengan format timestamp ISO
- ✅ **Node Cache** - Cache untuk performa
- ✅ **Retry Mechanism** - Automatic retry untuk request yang gagal
- ✅ **Full History Sync** - Opsi sync history lengkap
- ✅ **Lazy Load History** - Load history on demand

---

## 📖 Cara Menggunakan

### Import Functions
```javascript
const {
  sendText,
  sendImage,
  sendVideo,
  sendAudio,
  sendDocument,
  sendButtonMessage,
  sendListMessage,
  sendLocation,
  sendContact,
  sendPoll,
  createGroup,
  addGroupMembers,
  removeGroupMembers,
  // ... dan fungsi lainnya
} = require('./lib/index');
```

### Contoh Penggunaan

#### 1. Mengirim Teks
```javascript
await sendText(socket, '628XXXXX@s.whatsapp.net', 'Halo dari bot! 👋');
```

#### 2. Mengirim Gambar
```javascript
await sendImage(socket, '628XXXXX@s.whatsapp.net', './image.jpg', 'Ini gambarku!');
```

#### 3. Mengirim Button Message
```javascript
await sendButtonMessage(socket, '628XXXXX@s.whatsapp.net', [
  { buttonId: '1', buttonText: 'Pilihan 1' },
  { buttonId: '2', buttonText: 'Pilihan 2' },
  { buttonId: '3', buttonText: 'Pilihan 3' }
], 'Pilih salah satu:', 'Bot Footer');
```

#### 4. Membuat Grup
```javascript
const groupId = await createGroup(socket, 'Nama Grup', [
  '628XXXXX@s.whatsapp.net',
  '628YYYYY@s.whatsapp.net'
]);
```

#### 5. Menambah Anggota Grup
```javascript
await addGroupMembers(socket, groupId, ['628ZZZZZ@s.whatsapp.net']);
```

#### 6. Kirim Poll
```javascript
await sendPoll(socket, '628XXXXX@s.whatsapp.net', 'Pilihan Favorit?', [
  'Option 1',
  'Option 2',
  'Option 3'
]);
```

---

## 📁 File Structure
```
Baileys/
├── src/
│   ├── index.ts          # Main bot logic & functions
│   └── app.ts            # Application entry point
├── lib/                  # Compiled JavaScript (auto-generated)
├── auth_info/            # Session data (auto-generated)
├── media/                # Downloaded media (auto-generated)
├── logs/                 # Log files (auto-generated)
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── README.md             # Usage guide
└── FEATURES.md           # This file
```

---

## 🔄 Auto-Forward to Channel

Setiap pesan yang masuk akan otomatis diteruskan ke channel dengan format:

```
📨 New Message

From: Nama Pengirim
Chat: Private atau Group
Time: 2024-01-01 10:30:45

Message:
[Isi pesan]
```

Channel dapat diubah pada line 10 di `src/index.ts`:
```typescript
const CHANNEL_JID = '0029Vb9FLjYIN9im3Ip1Oj3p@newsletter';
```

---

## 🚀 Installation & Running

### 1. Install Dependencies
```bash
npm install
```

### 2. Compile TypeScript
```bash
npm run build:tsc
```

### 3. Run Bot
```bash
npm start
# atau
node lib/app.js
```

### 4. Scan QR Code
Bot akan menampilkan QR code di terminal. Scan dengan WhatsApp untuk login.

---

## ⚙️ Configuration

Edit `src/index.ts` untuk mengubah:
- **CHANNEL_JID** - Tujuan forward pesan
- **AUTH_FOLDER** - Lokasi penyimpanan session
- **MEDIA_FOLDER** - Lokasi penyimpanan media
- **LOG_FOLDER** - Lokasi penyimpanan log
- Browser profile (Chrome version, User Agent, dll)

---

## 📝 Logging

Semua activity dicatat otomatis ke:
- **Console** - Real-time logging
- **Log Files** - Simpan di folder `logs/`
- **Timestamps** - Format ISO 8601

---

## ⚠️ Disclaimer

- Ini adalah library **UNOFFICIAL** untuk WhatsApp Web
- Penggunaan harus sesuai dengan Terms of Service WhatsApp
- Penyalahgunaan dapat menyebabkan ban akun
- Gunakan dengan bijak dan bertanggung jawab

---

## 📞 Support

Untuk pertanyaan atau issue, silakan buat issue di repository ini.

Enjoy! 🎉