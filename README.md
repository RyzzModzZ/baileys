# 🚀 Baileys Complete Bot - All Features Edition

> **Complete WhatsApp Baileys Bot with ALL features from official repository**
> Auto-forward to your WhatsApp channel

## 📦 Features Included

### 📨 Messaging (15+ Functions)
- ✅ Send Text
- ✅ Send Image/Video/Audio/Document  
- ✅ Send GIF
- ✅ Send Buttons
- ✅ Send List Messages
- ✅ Send Location
- ✅ Send Contact/vCard
- ✅ Send Polls
- ✅ Send Link Preview
- ✅ Send Reaction
- ✅ Forward Messages
- ✅ Delete Messages
- ✅ Edit Messages

### 👥 Group Management (10+ Functions)
- ✅ Create Group
- ✅ Add/Remove Members
- ✅ Promote/Demote to Admin
- ✅ Update Subject & Description
- ✅ Get Group Metadata
- ✅ Get/Revoke Invite Code
- ✅ Join via Invite Code
- ✅ Leave Group

### 👤 Profile & Contacts (8+ Functions)
- ✅ Get Profile Picture
- ✅ Get User Status
- ✅ Check Number Exists
- ✅ Update Profile Name
- ✅ Update Profile Status
- ✅ Update Profile Picture
- ✅ Get All Contacts
- ✅ Get All Chats

### 🟢 Presence & Status (2+ Functions)
- ✅ Set Presence (typing, recording, available)
- ✅ Subscribe to Presence Updates

### 💬 Chat Management (7+ Functions)
- ✅ Mark as Read
- ✅ Archive Chat
- ✅ Mute/Unmute
- ✅ Pin/Unpin
- ✅ Delete Chat
- ✅ Clear Messages

### 🔒 Privacy (3+ Functions)
- ✅ Block/Unblock User
- ✅ Get Blocklist

### 📥 Media (2+ Functions)
- ✅ Download Media
- ✅ Reject Calls

### 📱 Auto-Forward Feature
- ✅ Every incoming message auto-forwards to your channel
- ✅ Channel: `https://whatsapp.com/channel/0029Vb9FLjYIN9im3Ip1Oj3p`

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Build TypeScript
```bash
npm run build:tsc
```

### 3. Run Bot
```bash
npm start
```

### 4. Scan QR Code
Bot akan menampilkan QR code di terminal. Scan dengan WhatsApp untuk login.

---

## 📖 Usage Examples

### Send Text to Number
```javascript
const { sendText } = require('./lib/index');

await sendText(socket, '628XXXXX@s.whatsapp.net', 'Hello! 👋');
```

### Send Image
```javascript
const { sendImage } = require('./lib/index');

await sendImage(socket, '628XXXXX@s.whatsapp.net', './photo.jpg', 'Check this out!');
```

### Create Group
```javascript
const { createGroup } = require('./lib/index');

const groupId = await createGroup(socket, 'My Group', [
  '628XXXXX@s.whatsapp.net',
  '628YYYYY@s.whatsapp.net'
]);
```

### Send Buttons
```javascript
const { sendButtonMessage } = require('./lib/index');

await sendButtonMessage(socket, '628XXXXX@s.whatsapp.net', [
  { buttonId: '1', buttonText: 'Yes' },
  { buttonId: '2', buttonText: 'No' }
], 'Do you agree?');
```

### Send Poll
```javascript
const { sendPoll } = require('./lib/index');

await sendPoll(socket, '628XXXXX@s.whatsapp.net', 'What\'s your favorite?', [
  'Option 1',
  'Option 2',
  'Option 3'
]);
```

---

## 📁 File Structure
```
baileys/
├── src/
│   ├── index.ts          # Main bot + 40+ functions
│   └── app.ts            # Entry point
├── lib/                  # Compiled JS
├── auth_info/            # Session data
├── media/                # Downloaded media
├── logs/                 # Log files
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚙️ Configuration

Edit `src/index.ts` to change:
```typescript
const CHANNEL_JID = '0029Vb9FLjYIN9im3Ip1Oj3p@newsletter'; // Your channel
const AUTH_FOLDER = './auth_info';
const MEDIA_FOLDER = './media';
const LOG_FOLDER = './logs';
const STORE_FILE = './baileys_store.json';
```

---

## 📊 All 50+ Exported Functions

**Messaging:** `sendText`, `sendImage`, `sendVideo`, `sendAudio`, `sendDocument`, `sendGif`, `sendButtonMessage`, `sendListMessage`, `sendLocation`, `sendContact`, `sendPoll`, `sendLinkPreview`, `sendReaction`, `forwardMessage`, `deleteMessage`, `editMessage`

**Groups:** `createGroup`, `addGroupMembers`, `removeGroupMembers`, `promoteGroupMembers`, `demoteGroupMembers`, `updateGroupSubject`, `updateGroupDescription`, `leaveGroup`, `getGroupMetadata`, `getGroupInviteCode`, `revokeGroupInviteCode`, `joinGroupByCode`

**Profile:** `getUserProfilePicture`, `getUserStatus`, `checkNumberExists`, `updateProfileName`, `updateProfileStatus`, `updateProfilePicture`, `getContacts`, `getChats`

**Presence:** `setPresence`, `subscribeToPresence`

**Chat:** `markChatAsRead`, `archiveChat`, `muteChat`, `unmuteChat`, `pinChat`, `unpinChat`, `deleteChat`, `clearChatMessages`

**Privacy:** `blockUser`, `unblockUser`, `getBlockList`

**Media:** `downloadMedia`, `rejectCall`

---

## ⚠️ Important Notes

- This is an **UNOFFICIAL** WhatsApp API
- Use responsibly and follow WhatsApp's Terms of Service
- Misuse may result in account ban
- No spam or bulk messaging
- For legitimate automation only

---

## 📞 Support

For issues or questions, create an issue in the repository.

**Enjoy!** 🎉