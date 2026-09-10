import startBot, {
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
  promoteGroupMembers,
  demoteGroupMembers,
  updateGroupSubject,
  updateGroupDescription,
  leaveGroup,
  getGroupMetadata,
  getUserProfilePicture,
  getUserStatus,
  updateUserProfile,
  setPresence,
  revokeMessage,
  getChats,
  getContacts,
  markChatAsRead,
  deleteChat
} from './index';

// ==================== START BOT ====================
(async () => {
  console.log('🚀 Starting WhatsApp Bot with Baileys...\n');
  await startBot();
})();

// Export all functions for external use
export {
  startBot,
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
  promoteGroupMembers,
  demoteGroupMembers,
  updateGroupSubject,
  updateGroupDescription,
  leaveGroup,
  getGroupMetadata,
  getUserProfilePicture,
  getUserStatus,
  updateUserProfile,
  setPresence,
  revokeMessage,
  getChats,
  getContacts,
  markChatAsRead,
  deleteChat
};