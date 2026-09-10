import makeWASocket, {
  default as WASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestWAWebVersion,
  proto,
  WAMessageContent,
  AnyMessageContent,
  ConnectionState,
  Browsers
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

// ==================== LOGGER SETUP ====================
const logger = pino.default({ level: 'info', timestamp: pino.stdTimeFunctions.isoTime });
const msgRetryCounterCache = new NodeCache.default();

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
    const isBroadcast = chat.endsWith('@broadcast');
    const timestamp = new Date(message.messageTimestamp! * 1000);

    logger.info(`📨 Message from ${sender} in ${chat}`);

    // ==================== AUTO-FORWARD TO CHANNEL ====================
    try {
      const messageText = message.message.conversation || 
                         message.message.extendedTextMessage?.text || 
                         '[Media Message]';
      
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

    // ==================== AUTO-REPLY ====================
    if (message.message.conversation?.toLowerCase().includes('ping')) {
      await socket.sendMessage(chat, { 
        text: '🏓 Pong! Bot is alive!' 
      }, { quoted: message });
    }

  } catch (error) {
    logger.error(`❌ Error handling message: ${error}`);
  }
};

// ==================== MESSAGE UPDATE HANDLER ====================
const handleMessageUpdate = async (socket: WASocket, update: proto.IMessageUpdate) => {
  for (const { key, update: msgUpdate } of update.updates ?? []) {
    if (msgUpdate.pollUpdates) {
      const pollCreation = await socket.getMessage(key);
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
      browser: Browsers.ubuntu('Chrome'),
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
    });

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
      logger.info(`🟢 Presence update: ${update.id} - ${update.presences}`);
    });

    // Handle call updates
    socket.ev.on('call', async (calls) => {
      logger.info(`📞 Incoming call from ${calls[0].from}`);
    });

    logger.info(`🚀 Bot started successfully!`);
    return socket;

  } catch (error) {
    logger.error(`❌ Failed to start bot: ${error}`);
    setTimeout(startBot, 5000);
  }
};

// ==================== HELPER FUNCTIONS ====================

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
export const sendImage = async (socket: WASocket, jid: string, imagePath: string, caption?: string) => {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    await socket.sendMessage(jid, {
      image: imageBuffer,
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
export const sendVideo = async (socket: WASocket, jid: string, videoPath: string, caption?: string) => {
  try {
    const videoBuffer = fs.readFileSync(videoPath);
    await socket.sendMessage(jid, {
      video: videoBuffer,
      caption: caption || '',
      mimetype: 'video/mp4'
    });
    logger.info(`✓ Video sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send video: ${err}`);
  }
};

/**
 * Send audio message
 */
export const sendAudio = async (socket: WASocket, jid: string, audioPath: string) => {
  try {
    const audioBuffer = fs.readFileSync(audioPath);
    await socket.sendMessage(jid, {
      audio: audioBuffer,
      mimetype: 'audio/mpeg',
      ptt: false
    });
    logger.info(`✓ Audio sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send audio: ${err}`);
  }
};

/**
 * Send document/file
 */
export const sendDocument = async (socket: WASocket, jid: string, filePath: string, fileName?: string) => {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    await socket.sendMessage(jid, {
      document: fileBuffer,
      fileName: fileName || path.basename(filePath),
      mimetype: 'application/octet-stream'
    });
    logger.info(`✓ Document sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send document: ${err}`);
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
      footer: footer || 'Bot Footer',
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
  rows: Array<{ rowId: string; title: string; description?: string }>
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
      ]
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
  phoneNumber: string
) => {
  try {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${displayName}\nTEL:${phoneNumber}\nEND:VCARD`;
    await socket.sendMessage(jid, {
      contacts: {
        displayName,
        contacts: [{
          vcard
        }]
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
  options: string[]
) => {
  try {
    await socket.sendMessage(jid, {
      poll: {
        name: question,
        values: options,
        selectableCount: 1
      }
    });
    logger.info(`✓ Poll sent to ${jid}`);
  } catch (err) {
    logger.error(`❌ Failed to send poll: ${err}`);
  }
};

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
 * Update group subject
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
 * Update user profile
 */
export const updateUserProfile = async (
  socket: WASocket,
  updates: {
    pushName?: string;
    status?: string;
  }
) => {
  try {
    if (updates.pushName) {
      await socket.updateProfileName(updates.pushName);
    }
    if (updates.status) {
      await socket.updateProfileStatus(updates.status);
    }
    logger.info(`✓ Profile updated`);
  } catch (err) {
    logger.error(`❌ Failed to update profile: ${err}`);
  }
};

/**
 * Set presence status (typing, recording, etc.)
 */
export const setPresence = async (
  socket: WASocket,
  jid: string,
  status: 'typing' | 'recording' | 'paused'
) => {
  try {
    await socket.sendPresenceUpdate(status, jid);
    logger.info(`✓ Presence set to ${status}`);
  } catch (err) {
    logger.error(`❌ Failed to set presence: ${err}`);
  }
};

/**
 * Revoke message
 */
export const revokeMessage = async (socket: WASocket, message: proto.IWebMessageInfo) => {
  try {
    await socket.sendMessage(message.key.remoteJid!, {
      delete: message.key
    });
    logger.info(`✓ Message revoked`);
  } catch (err) {
    logger.error(`❌ Failed to revoke message: ${err}`);
  }
};

/**
 * Get chats
 */
export const getChats = async (socket: WASocket) => {
  try {
    const chats = socket.store.chats.all();
    logger.info(`✓ ${chats.length} chats fetched`);
    return chats;
  } catch (err) {
    logger.error(`❌ Failed to get chats: ${err}`);
  }
};

/**
 * Get contacts
 */
export const getContacts = async (socket: WASocket) => {
  try {
    const contacts = socket.store.contacts;
    logger.info(`✓ Contacts fetched`);
    return contacts;
  } catch (err) {
    logger.error(`❌ Failed to get contacts: ${err}`);
  }
};

/**
 * Mark chat as read
 */
export const markChatAsRead = async (socket: WASocket, jid: string) => {
  try {
    await socket.readMessages([
      {
        remoteJid: jid,
        id: 'all'
      }
    ]);
    logger.info(`✓ Chat marked as read`);
  } catch (err) {
    logger.error(`❌ Failed to mark as read: ${err}`);
  }
};

/**
 * Delete chat
 */
export const deleteChat = async (socket: WASocket, jid: string) => {
  try {
    const chats = socket.store.chats.all();
    const chat = chats.find(c => c.id === jid);
    if (chat) {
      socket.store.chats.delete(jid);
      logger.info(`✓ Chat deleted`);
    }
  } catch (err) {
    logger.error(`❌ Failed to delete chat: ${err}`);
  }
};

// ==================== EXPORT ====================
export default startBot;