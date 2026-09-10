import makeWASocket, {
  default as WASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestWAWebVersion,
  proto,
  WAMessageContent,
  AnyMessageContent,
  ConnectionState,
  Browsers,
  makeInMemoryStore,
  downloadMediaMessage,
  getContentType,
  MessageType,
  waMessageFromContact,
  BufferJSON,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import * as pino from 'pino';
import * as NodeCache from 'node-cache';
import axios from 'axios';

// ==================== CONFIGURATIONS ====================
const CHANNEL_JID = '0029Vb9FLjYIN9im3Ip1Oj3p@newsletter'; // Auto-forward destination
const AUTH_FOLDER = './auth_info';
const MEDIA_FOLDER = './media';
const LOG_FOLDER = './logs';
const STORE_FILE = './baileys_store.json';

// ==================== LOGGER SETUP ====================
const logger = pino.default({ level: 'info', timestamp: pino.stdTimeFunctions.isoTime });
const msgRetryCounterCache = new NodeCache.default();
const store = makeInMemoryStore({ logger });

// ==================== ENSURE DIRECTORIES ====================
const ensureDirectories = () => {
  [AUTH_FOLDER, MEDIA_FOLDER, LOG_FOLDER].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`✓ Created directory: ${dir}`);
    }
  });
};

// ==================== MESSAGE HANDLER ====================
const handleMessage = async (socket: WASocket, message: proto.IWebMessageInfo) => {
  try {
    if (!message.message) return;

    const chat = message.key.remoteJid!;
    const sender = message.key.participant || message.key.remoteJid!;
    const isGroup = chat.endsWith('@g.us');
    const timestamp = new Date(message.messageTimestamp! * 1000);

    logger.info(`📨 Message from ${sender} in ${chat}`);

    // ==================== AUTO-FORWARD TO CHANNEL ====================
    try {
      const messageType = getContentType(message.message);
      let messageText = '';

      if (messageType === 'conversation') {
        messageText = message.message.conversation || '';
      } else if (messageType === 'extendedTextMessage') {
        messageText = message.message.extendedTextMessage?.text || '';
      } else if (messageType === 'imageMessage') {
        messageText = `[Image] ${message.message.imageMessage?.caption || ''}`;
      } else if (messageType === 'videoMessage') {
        messageText = `[Video] ${message.message.videoMessage?.caption || ''}`;
      } else if (messageType === 'audioMessage') {
        messageText = '[Audio Message]';
      } else if (messageType === 'documentMessage') {
        messageText = `[Document] ${message.message.documentMessage?.fileName || ''}`;
      } else if (messageType === 'locationMessage') {
        messageText = '[Location Shared]';
      } else if (messageType === 'contactMessage') {
        messageText = '[Contact Shared]';
      } else if (messageType === 'stickerMessage') {
        messageText = '[Sticker]';
      } else if (messageType === 'pollCreationMessage') {
        messageText = `[Poll] ${message.message.pollCreationMessage?.name || 'Poll'}`;
      } else {
        messageText = `[${messageType || 'Unknown'}]`;
      }

      const senderInfo = isGroup 
        ? await socket.groupMetadata(chat).then(meta => {
            const participant = meta.participants.find(p => p.id === sender);
            return participant?.pushName || sender;
          }).catch(() => sender)
        : sender;

      const forwardText = `📨 *New Message*\n\n*From:* ${senderInfo}\n*Chat:* ${isGroup ? 'Group' : 'Private'}\n*Time:* ${timestamp.toLocaleString()}\n\n*Message:*\n${messageText}`;

      await socket.sendMessage(CHANNEL_JID, { text: forwardText });
      logger.info(`✓ Message forwarded to channel`);
    } catch (err) {
      logger.warn(`⚠ Failed to forward message to channel: ${err}`);
    }

  } catch (error) {
    logger.error(`❌ Error handling message: ${error}`);
  }
};

// ==================== MESSAGE UPDATE HANDLER ====================
const handleMessageUpdate = async (socket: WASocket, update: proto.IMessageUpdate) => {
  for (const { key, update: msgUpdate } of update.updates ?? []) {
    if (msgUpdate.pollUpdates) {
      const pollCreation = await store.loadMessage(key);
      if (pollCreation?.message?.pollCreationMessage) {
        logger.info(`📊 Poll update received`);
      }
    }
  }
};

// ==================== CONNECTION HANDLER ====================
const handleConnectionUpdate = async (socket: WASocket, update: Partial<ConnectionState>) => {
  const { connection, lastDisconnect, isNewLogin, qr } = update;

  if (connection === 'close') {
    const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
    logger.error(`❌ Connection closed: ${(lastDisconnect?.error as Boom)?.output?.statusCode}`);
    if (shouldReconnect) {
      startBot();
    }
  } else if (connection === 'connecting') {
    logger.info(`⏳ Connecting...`);
  } else if (connection === 'open') {
    logger.info(`✅ Connection established!`);
  }

  if (isNewLogin) {
    logger.info(`✅ New login detected`);
  }

  if (qr) {
    logger.info(`📱 QR Code generated - scan to login`);
  }
};

// ==================== MAIN BOT FUNCTION ====================
const startBot = async () => {
  try {
    ensureDirectories();

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    
    const socket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      browser: Browsers.ubuntu('WhatsApp Bot'),
      msgRetryCounterCache,
      logger,
      version: await fetchLatestWAWebVersion(),
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      retryRequestDelayMs: 10,
      fireInitQueries: false,
      emitOwnEventsOnly: false,
      defaultQueryTimeoutMs: undefined,
    });

    // Bind store
    store.bind(socket.ev);

    // ==================== EVENT LISTENERS ====================
    
    // Handle messages
    socket.ev.on('messages.upsert', async (m) => {
      for (const message of m.messages) {
        await handleMessage(socket, message);
      }
    });

    // Handle message updates
    socket.ev.on('messages.update', (m) => handleMessageUpdate(socket, m));

    // Handle connection updates
    socket.ev.on('connection.update', (update) => handleConnectionUpdate(socket, update));

    // Save credentials
    socket.ev.on('creds.update', saveCreds);

    // Handle group updates
    socket.ev.on('groups.upsert', (groups) => {
      logger.info(`📊 ${groups.length} group(s) updated`);
    });

    // Handle group membership updates
    socket.ev.on('group-participants.update', (update) => {
      logger.info(`👥 Group ${update.id}: ${update.action} - ${update.participants}`);
    });

    // Handle contacts updates
    socket.ev.on('contacts.upsert', (contacts) => {
      logger.info(`📇 ${contacts.length} contact(s) updated`);
    });

    // Handle chat updates
    socket.ev.on('chats.set', (chats) => {
      logger.info(`💬 ${chats.chats.length} chat(s) loaded`);
    });

    // Handle presence updates
    socket.ev.on('presence.update', (update) => {
      logger.info(`🟢 Presence update: ${update.id}`);
    });

    // Handle call updates
    socket.ev.on('call', async (calls) => {
      logger.info(`📞 Incoming call from ${calls[0].from}`);
    });

    // Save store periodically
    setInterval(() => {
      store.writeToFile(STORE_FILE);
    }, 10000);

    // Load store from file
    if (fs.existsSync(STORE_FILE)) {
      store.readFromFile(STORE_FILE);
    }

    logger.info(`🚀 Bot started successfully!`);
    return socket;

  } catch (error) {
    logger.error(`❌ Failed to start bot: ${error}`);
    setTimeout(startBot, 5000);
  }
};

// ==================== HELPER FUNCTIONS - MESSAGING ====================

/**
 * Send text message
 */
export const sendText = async (socket: WASocket, jid: string, text: string, quoted?: proto.IWebMessageInfo) => {
  try {
    await socket.sendMessage(jid, { text }, { quoted });
    logger.info(`✓ Text message sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send text: ${err}`);
  }
};

/**
 * Send image with caption
 */
export const sendImage = async (socket: WASocket, jid: string, imagePath: string | Buffer | { url: string }, caption?: string) => {
  try {
    await socket.sendMessage(jid, {
      image: imagePath,
      caption: caption || ''
    });
    logger.info(`✓ Image sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send image: ${err}`);
  }
};

/**
 * Send video with caption
 */
export const sendVideo = async (socket: WASocket, jid: string, videoPath: string | Buffer | { url: string }, caption?: string, ptv?: boolean) => {
  try {
    await socket.sendMessage(jid, {
      video: videoPath,
      caption: caption || '',
      mimetype: 'video/mp4',
      ptv: ptv || false
    });
    logger.info(`✓ Video sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send video: ${err}`);
  }
};

/**
 * Send audio message
 */
export const sendAudio = async (socket: WASocket, jid: string, audioPath: string | Buffer | { url: string }, ptt?: boolean) => {
  try {
    await socket.sendMessage(jid, {
      audio: audioPath,
      mimetype: 'audio/mpeg',
      ptt: ptt || false
    });
    logger.info(`✓ Audio sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send audio: ${err}`);
  }
};

/**
 * Send document/file
 */
export const sendDocument = async (socket: WASocket, jid: string, filePath: string | Buffer | { url: string }, fileName?: string, mimetype?: string) => {
  try {
    await socket.sendMessage(jid, {
      document: filePath,
      fileName: fileName || 'document',
      mimetype: mimetype || 'application/octet-stream'
    });
    logger.info(`✓ Document sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send document: ${err}`);
  }
};

/**
 * Send GIF (as video with gifPlayback)
 */
export const sendGif = async (socket: WASocket, jid: string, gifPath: string | Buffer | { url: string }, caption?: string) => {
  try {
    await socket.sendMessage(jid, {
      video: gifPath,
      caption: caption || '',
      gifPlayback: true
    });
    logger.info(`✓ GIF sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send GIF: ${err}`);
  }
};

/**
 * Send button message
 */
export const sendButtonMessage = async (
  socket: WASocket,
  jid: string,
  buttons: Array<{ buttonId: string; buttonText: string }>,
  text: string,
  footer?: string
) => {
  try {
    await socket.sendMessage(jid, {
      text,
      footer: footer || 'Bot',
      buttons: buttons.map(btn => ({
        buttonId: btn.buttonId,
        buttonText: { displayText: btn.buttonText },
        type: 1
      })),
      headerType: 1
    });
    logger.info(`✓ Button message sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send button message: ${err}`);
  }
};

/**
 * Send list message
 */
export const sendListMessage = async (
  socket: WASocket,
  jid: string,
  title: string,
  rows: Array<{ rowId: string; title: string; description?: string }>,
  buttonText?: string
) => {
  try {
    await socket.sendMessage(jid, {
      text: title,
      sections: [
        {
          title: 'Menu',
          rows: rows.map(row => ({
            rowId: row.rowId,
            title: row.title,
            description: row.description || ''
          }))
        }
      ],
      buttonText: buttonText || 'Select'
    });
    logger.info(`✓ List message sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send list message: ${err}`);
  }
};

/**
 * Send location
 */
export const sendLocation = async (
  socket: WASocket,
  jid: string,
  latitude: number,
  longitude: number,
  name?: string
) => {
  try {
    await socket.sendMessage(jid, {
      location: {
        degreesLatitude: latitude,
        degreesLongitude: longitude,
        name: name || 'Location'
      }
    });
    logger.info(`✓ Location sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send location: ${err}`);
  }
};

/**
 * Send contact/vCard
 */
export const sendContact = async (
  socket: WASocket,
  jid: string,
  displayName: string,
  phoneNumber: string,
  organization?: string
) => {
  try {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL:${phoneNumber}${organization ? `\nORG:${organization}` : ''}\nEND:VCARD`;
    await socket.sendMessage(jid, {
      contacts: {
        displayName,
        contacts: [{ vcard }]
      }
    });
    logger.info(`✓ Contact sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send contact: ${err}`);
  }
};

/**
 * Send poll message
 */
export const sendPoll = async (
  socket: WASocket,
  jid: string,
  question: string,
  options: string[],
  selectableCount?: number
) => {
  try {
    await socket.sendMessage(jid, {
      poll: {
        name: question,
        values: options,
        selectableCount: selectableCount || 1
      }
    });
    logger.info(`✓ Poll sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send poll: ${err}`);
  }
};

/**
 * Send message with link preview
 */
export const sendLinkPreview = async (socket: WASocket, jid: string, url: string, text?: string) => {
  try {
    await socket.sendMessage(jid, {
      text: text || url
    });
    logger.info(`✓ Link preview message sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send link preview: ${err}`);
  }
};

/**
 * Send reaction to message
 */
export const sendReaction = async (socket: WASocket, jid: string, messageKey: proto.IMessageKey, emoji: string) => {
  try {
    await socket.sendMessage(jid, {
      react: {
        text: emoji,
        key: messageKey
      }
    });
    logger.info(`✓ Reaction sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send reaction: ${err}`);
  }
};

/**
 * Forward message
 */
export const forwardMessage = async (socket: WASocket, jid: string, message: proto.IWebMessageInfo) => {
  try {
    await socket.sendMessage(jid, { forward: message });
    logger.info(`✓ Message forwarded to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to forward message: ${err}`);
  }
};

/**
 * Delete message for everyone
 */
export const deleteMessage = async (socket: WASocket, jid: string, messageKey: proto.IMessageKey) => {
  try {
    await socket.sendMessage(jid, { delete: messageKey });
    logger.info(`✓ Message deleted from ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to delete message: ${err}`);
  }
};

/**
 * Edit message
 */
export const editMessage = async (socket: WASocket, jid: string, messageKey: proto.IMessageKey, newText: string) => {
  try {
    await socket.sendMessage(jid, {
      text: newText,
      edit: messageKey
    });
    logger.info(`✓ Message edited in ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to edit message: ${err}`);
  }
};

// ==================== HELPER FUNCTIONS - GROUP MANAGEMENT ====================

/**
 * Create group
 */
export const createGroup = async (
  socket: WASocket,
  groupName: string,
  participants: string[]
) => {
  try {
    const group = await socket.groupCreate(groupName, participants);
    logger.info(`✓ Group created: ${group.gid}`);
    return group.gid;
  } catch (err) {
    logger.error(`❌ Failed to create group: ${err}`);
  }
};

/**
 * Add members to group
 */
export const addGroupMembers = async (
  socket: WASocket,
  groupJid: string,
  members: string[]
) => {
  try {
    await socket.groupParticipantsUpdate(groupJid, members, 'add');
    logger.info(`✓ Members added to group ${groupJid}`);
  } catch (err) {
    logger.error(`❌ Failed to add members: ${err}`);
  }
};

/**
 * Remove members from group
 */
export const removeGroupMembers = async (
  socket: WASocket,
  groupJid: string,
  members: string[]
) => {
  try {
    await socket.groupParticipantsUpdate(groupJid, members, 'remove');
    logger.info(`✓ Members removed from group ${groupJid}`);
  } catch (err) {
    logger.error(`❌ Failed to remove members: ${err}`);
  }
};

/**
 * Promote group members to admin
 */
export const promoteGroupMembers = async (
  socket: WASocket,
  groupJid: string,
  members: string[]
) => {
  try {
    await socket.groupParticipantsUpdate(groupJid, members, 'promote');
    logger.info(`✓ Members promoted in group ${groupJid}`);
  } catch (err) {
    logger.error(`❌ Failed to promote members: ${err}`);
  }
};

/**
 * Demote group members from admin
 */
export const demoteGroupMembers = async (
  socket: WASocket,
  groupJid: string,
  members: string[]
) => {
  try {
    await socket.groupParticipantsUpdate(groupJid, members, 'demote');
    logger.info(`✓ Members demoted in group ${groupJid}`);
  } catch (err) {
    logger.error(`❌ Failed to demote members: ${err}`);
  }
};

/**
 * Update group subject (name)
 */
export const updateGroupSubject = async (
  socket: WASocket,
  groupJid: string,
  subject: string
) => {
  try {
    await socket.groupUpdateSubject(groupJid, subject);
    logger.info(`✓ Group subject updated to: ${subject}`);
  } catch (err) {
    logger.error(`❌ Failed to update group subject: ${err}`);
  }
};

/**
 * Update group description
 */
export const updateGroupDescription = async (
  socket: WASocket,
  groupJid: string,
  description: string
) => {
  try {
    await socket.groupUpdateDescription(groupJid, description);
    logger.info(`✓ Group description updated`);
  } catch (err) {
    logger.error(`❌ Failed to update group description: ${err}`);
  }
};

/**
 * Leave group
 */
export const leaveGroup = async (socket: WASocket, groupJid: string) => {
  try {
    await socket.groupLeave(groupJid);
    logger.info(`✓ Left group ${groupJid}`);
  } catch (err) {
    logger.error(`❌ Failed to leave group: ${err}`);
  }
};

/**
 * Get group metadata
 */
export const getGroupMetadata = async (socket: WASocket, groupJid: string) => {
  try {
    const metadata = await socket.groupMetadata(groupJid);
    logger.info(`✓ Group metadata fetched`);
    return metadata;
  } catch (err) {
    logger.error(`❌ Failed to get group metadata: ${err}`);
  }
};

/**
 * Get group invite code
 */
export const getGroupInviteCode = async (socket: WASocket, groupJid: string) => {
  try {
    const code = await socket.groupInviteCode(groupJid);
    logger.info(`✓ Group invite code: ${code}`);
    return code;
  } catch (err) {
    logger.error(`❌ Failed to get invite code: ${err}`);
  }
};

/**
 * Revoke group invite code
 */
export const revokeGroupInviteCode = async (socket: WASocket, groupJid: string) => {
  try {
    await socket.groupRevokeInvite(groupJid);
    logger.info(`✓ Group invite code revoked`);
  } catch (err) {
    logger.error(`❌ Failed to revoke invite code: ${err}`);
  }
};

/**
 * Join group via invite code
 */
export const joinGroupByCode = async (socket: WASocket, inviteCode: string) => {
  try {
    const groupId = await socket.groupAcceptInvite(inviteCode);
    logger.info(`✓ Joined group: ${groupId}`);
    return groupId;
  } catch (err) {
    logger.error(`❌ Failed to join group: ${err}`);
  }
};

// ==================== HELPER FUNCTIONS - PROFILE & CONTACTS ====================

/**
 * Get user profile picture
 */
export const getUserProfilePicture = async (
  socket: WASocket,
  jid: string,
  highRes?: boolean
) => {
  try {
    const pic = await socket.profilePictureUrl(jid, highRes ? 'image' : 'preview');
    logger.info(`✓ Profile picture URL: ${pic}`);
    return pic;
  } catch (err) {
    logger.error(`❌ Failed to get profile picture: ${err}`);
  }
};

/**
 * Get user status
 */
export const getUserStatus = async (socket: WASocket, jid: string) => {
  try {
    const status = await socket.fetchStatus(jid);
    logger.info(`✓ User status fetched`);
    return status;
  } catch (err) {
    logger.error(`❌ Failed to get user status: ${err}`);
  }
};

/**
 * Check if number exists on WhatsApp
 */
export const checkNumberExists = async (socket: WASocket, number: string) => {
  try {
    const [result] = await socket.onWhatsApp(number);
    logger.info(`✓ Number existence checked`);
    return result;
  } catch (err) {
    logger.error(`❌ Failed to check number: ${err}`);
  }
};

/**
 * Update user profile name
 */
export const updateProfileName = async (
  socket: WASocket,
  name: string
) => {
  try {
    await socket.updateProfileName(name);
    logger.info(`✓ Profile name updated to: ${name}`);
  } catch (err) {
    logger.error(`❌ Failed to update profile name: ${err}`);
  }
};

/**
 * Update user profile status
 */
export const updateProfileStatus = async (
  socket: WASocket,
  status: string
) => {
  try {
    await socket.updateProfileStatus(status);
    logger.info(`✓ Profile status updated`);
  } catch (err) {
    logger.error(`❌ Failed to update profile status: ${err}`);
  }
};

/**
 * Update user profile picture
 */
export const updateProfilePicture = async (
  socket: WASocket,
  imagePath: string | Buffer | { url: string }
) => {
  try {
    await socket.updateProfilePicture(socket.user!.id, imagePath);
    logger.info(`✓ Profile picture updated`);
  } catch (err) {
    logger.error(`❌ Failed to update profile picture: ${err}`);
  }
};

/**
 * Get all contacts
 */
export const getContacts = async (socket: WASocket) => {
  try {
    const contacts = store.contacts;
    logger.info(`✓ Contacts fetched`);
    return contacts;
  } catch (err) {
    logger.error(`❌ Failed to get contacts: ${err}`);
  }
};

/**
 * Get all chats
 */
export const getChats = async (socket: WASocket) => {
  try {
    const chats = store.chats.all();
    logger.info(`✓ ${chats.length} chats fetched`);
    return chats;
  } catch (err) {
    logger.error(`❌ Failed to get chats: ${err}`);
  }
};

// ==================== HELPER FUNCTIONS - PRESENCE & STATUS ====================

/**
 * Set presence status (typing, recording, etc.)
 */
export const setPresence = async (
  socket: WASocket,
  jid: string,
  status: 'typing' | 'recording' | 'paused' | 'available' | 'unavailable'
) => {
  try {
    await socket.sendPresenceUpdate(status, jid);
    logger.info(`✓ Presence set to ${status}`);
  } catch (err) {
    logger.error(`❌ Failed to set presence: ${err}`);
  }
};

/**
 * Subscribe to presence updates
 */
export const subscribeToPresence = async (socket: WASocket, jid: string) => {
  try {
    await socket.presenceSubscribe(jid);
    logger.info(`✓ Subscribed to presence updates for ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to subscribe: ${err}`);
  }
};

// ==================== HELPER FUNCTIONS - CHAT MANAGEMENT ====================

/**
 * Mark chat as read
 */
export const markChatAsRead = async (socket: WASocket, jid: string) => {
  try {
    await socket.readMessages([{ remoteJid: jid, id: 'all' }]);
    logger.info(`✓ Chat marked as read`);
  } catch (err) {
    logger.error(`❌ Failed to mark as read: ${err}`);
  }
};

/**
 * Archive chat
 */
export const archiveChat = async (socket: WASocket, jid: string) => {
  try {
    const lastMsg = store.loadMessage(jid);
    if (lastMsg) {
      await socket.chatModify({ archive: true, lastMessages: [lastMsg] }, jid);
      logger.info(`✓ Chat archived`);
    }
  } catch (err) {
    logger.error(`❌ Failed to archive chat: ${err}`);
  }
};

/**
 * Mute/Unmute chat
 */
export const muteChat = async (socket: WASocket, jid: string, muteMs?: number) => {
  try {
    await socket.chatModify({ mute: muteMs || 8 * 60 * 60 * 1000 }, jid);
    logger.info(`✓ Chat muted`);
  } catch (err) {
    logger.error(`❌ Failed to mute chat: ${err}`);
  }
};

/**
 * Unmute chat
 */
export const unmuteChat = async (socket: WASocket, jid: string) => {
  try {
    await socket.chatModify({ mute: null }, jid);
    logger.info(`✓ Chat unmuted`);
  } catch (err) {
    logger.error(`❌ Failed to unmute chat: ${err}`);
  }
};

/**
 * Pin chat
 */
export const pinChat = async (socket: WASocket, jid: string) => {
  try {
    await socket.chatModify({ pin: true }, jid);
    logger.info(`✓ Chat pinned`);
  } catch (err) {
    logger.error(`❌ Failed to pin chat: ${err}`);
  }
};

/**
 * Unpin chat
 */
export const unpinChat = async (socket: WASocket, jid: string) => {
  try {
    await socket.chatModify({ pin: false }, jid);
    logger.info(`✓ Chat unpinned`);
  } catch (err) {
    logger.error(`❌ Failed to unpin chat: ${err}`);
  }
};

/**
 * Delete chat
 */
export const deleteChat = async (socket: WASocket, jid: string) => {
  try {
    const chats = store.chats.all();
    const chat = chats.find(c => c.id === jid);
    if (chat) {
      store.chats.delete(jid);
      logger.info(`✓ Chat deleted`);
    }
  } catch (err) {
    logger.error(`❌ Failed to delete chat: ${err}`);
  }
};

/**
 * Clear all messages in chat
 */
export const clearChatMessages = async (socket: WASocket, jid: string) => {
  try {
    await socket.chatModify({ clear: { messages: [] } }, jid);
    logger.info(`✓ Chat cleared`);
  } catch (err) {
    logger.error(`❌ Failed to clear chat: ${err}`);
  }
};

// ==================== HELPER FUNCTIONS - PRIVACY ====================

/**
 * Block user
 */
export const blockUser = async (socket: WASocket, jid: string) => {
  try {
    await socket.updateBlockStatus(jid, 'block');
    logger.info(`✓ User blocked: ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to block user: ${err}`);
  }
};

/**
 * Unblock user
 */
export const unblockUser = async (socket: WASocket, jid: string) => {
  try {
    await socket.updateBlockStatus(jid, 'unblock');
    logger.info(`✓ User unblocked: ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to unblock user: ${err}`);
  }
};

/**
 * Get block list
 */
export const getBlockList = async (socket: WASocket) => {
  try {
    const blocklist = await socket.fetchBlocklist();
    logger.info(`✓ Blocklist fetched`);
    return blocklist;
  } catch (err) {
    logger.error(`❌ Failed to fetch blocklist: ${err}`);
  }
};

// ==================== HELPER FUNCTIONS - MEDIA ====================

/**
 * Download media from message
 */
export const downloadMedia = async (
  socket: WASocket,
  message: proto.IWebMessageInfo,
  savePath?: string
) => {
  try {
    const messageType = getContentType(message.message);
    if (!messageType || !['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(messageType)) {
      logger.warn(`Message type not supported for download: ${messageType}`);
      return;
    }

    const stream = await downloadMediaMessage(message, 'stream', {}, {
      logger,
      reuploadRequest: socket.updateMediaMessage
    });

    if (savePath) {
      const writeStream = fs.createWriteStream(savePath);
      stream.pipe(writeStream);
      logger.info(`✓ Media saved to ${savePath}`);
    }

    return stream;
  } catch (err) {
    logger.error(`❌ Failed to download media: ${err}`);
  }
};

/**
 * Reject incoming call
 */
export const rejectCall = async (socket: WASocket, callId: string, callFrom: string) => {
  try {
    await socket.rejectCall(callId, callFrom);
    logger.info(`✓ Call rejected`);
  } catch (err) {
    logger.error(`❌ Failed to reject call: ${err}`);
  }
};

// ==================== EXPORT ====================
export default startBot;