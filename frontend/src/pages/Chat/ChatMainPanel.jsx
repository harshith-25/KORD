import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { useChatStore } from '@/store/chatStore';
import { useConversationStore } from '@/store/conversationStore';
import { useMessageStore } from '@/store/messageStore';
import { SignInPlaceholder, NoChatSelectedPlaceholder } from '@/skeletons/ChatPanel';
import ChatHeader from './ChatMessagePanel/ChatHeader';
import ChatMessagesPanel from './ChatMessagePanel/ChatMessagesPanel';
import ChatMessageInput from './ChatMessagePanel/ChatMessageInput';

function ChatMainPanel() {
	const {
		selectedChatId,
		loadingMessages: isChatStoreLoading,
		startTyping,
		stopTyping,
		onlineUsers,
		error: globalError,
		updateMessageStatus
	} = useChatStore();

	const { contacts } = useConversationStore();

	const {
		messages,
		sendMessage,
		loadingMessages,
	} = useMessageStore();

	const { user: currentUser } = useAuthStore();

	const contactsArray = contacts || [];

	const selectedChat = selectedChatId
		? contactsArray.find(contact =>
			contact.conversationId === selectedChatId ||
			contact.id === selectedChatId ||
			contact._id === selectedChatId
		)
		: null;

	const getTypingIndicatorText = useChatStore((state) => state.getTypingIndicatorText);

	const typingText = selectedChat?.conversationId
		? getTypingIndicatorText(selectedChat.conversationId)
		: '';

	const isTyping = typingText.length > 0;

	const currentMessages = messages[selectedChatId] || [];
	const messagesEndRef = useRef(null);
	const messagesContainerRef = useRef(null);
	const inputRef = useRef(null);

	const [messageInput, setMessageInput] = useState('');
	const [showScrollButton, setShowScrollButton] = useState(false);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);

	// NEW: Reply and Edit states
	const [editingMessage, setEditingMessage] = useState(null);
	const [replyingTo, setReplyingTo] = useState(null);

	const isGroupChat = selectedChat?.type !== 'direct';

	const getChatName = () => {
		if (!selectedChat) return '';

		if (selectedChat.type === 'direct' && selectedChat.participants) {
			if (!currentUser || !currentUser._id) {
				console.warn('Current user not found in auth store');
				return selectedChat.name || 'Unknown Chat';
			}

			const otherParticipant = selectedChat.participants.find(p => p._id !== currentUser._id);

			if (!otherParticipant) {
				return 'Unknown User';
			}

			return otherParticipant.firstName && otherParticipant.lastName
				? `${otherParticipant.firstName} ${otherParticipant.lastName}`
				: otherParticipant.firstName ||
				otherParticipant.lastName ||
				otherParticipant.name ||
				otherParticipant.username ||
				'Unknown User';
		}

		return selectedChat.name || selectedChat.conversationId || 'Unknown Chat';
	};

	const getChatAvatar = () => {
		if (!selectedChat) return null;

		if (selectedChat.type === 'direct' && selectedChat.participants) {
			if (!currentUser || !currentUser._id) {
				console.warn('Current user not found in auth store');
				return selectedChat.avatar || null;
			}

			const otherParticipant = selectedChat.participants.find(p => p._id !== currentUser._id);

			if (!otherParticipant) {
				return null;
			}

			const name = getChatName(selectedChat);

			return otherParticipant.image ||
				otherParticipant.avatar ||
				`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=random&radius=50`;
		}

		return selectedChat.avatar || null;
	};

	const getOnlineStatus = () => {
		if (!selectedChat || selectedChat.type !== 'direct') return false;

		if (!currentUser || !currentUser._id) {
			console.warn('Current user not found in auth store');
			return false;
		}

		const otherParticipant = selectedChat.participants?.find(p => p._id !== currentUser._id);

		if (!otherParticipant || !onlineUsers || !Array.isArray(onlineUsers)) {
			return false;
		}

		return onlineUsers.includes(otherParticipant._id);
	};

	const isUserOnline = getOnlineStatus();
	const chatName = getChatName();
	const chatAvatar = getChatAvatar();

	useEffect(() => {
		const handleResize = () => {
			setIsMobile(window.innerWidth < 768);
		};

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	}, []);

	const scrollToBottom = useCallback((behavior = 'smooth') => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior });
		}
	}, []);

	// Typing indicators handled by messageStore socket listeners
	useEffect(() => {
		const socketStore = useSocketStore.getState();
		const chatStore = useChatStore.getState();

		socketStore.onTyping(({ userId, conversationId }) => {
			chatStore.handleTypingStart(userId, conversationId);
		});

		socketStore.onStopTyping(({ userId, conversationId }) => {
			chatStore.handleTypingStop(userId, conversationId);
		});

		return () => {
			socketStore.offTyping();
			socketStore.offStopTyping();
		};
	}, []);

	const handleScroll = useCallback(() => {
		if (!messagesContainerRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
		const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;

		setIsAtBottom(isNearBottom);
		setShowScrollButton(!isNearBottom && currentMessages.length > 0);
	}, [currentMessages.length]);

	useEffect(() => {
		if (isAtBottom) {
			scrollToBottom('smooth');
		}
	}, [currentMessages, isAtBottom, scrollToBottom]);

	useEffect(() => {
		if (currentMessages.length > 0) {
			scrollToBottom('auto');
		}
	}, [selectedChatId]);

	const handleSendMessage = useCallback((e, replyToMessage = null) => {
		e?.preventDefault();
		if (messageInput.trim() && selectedChatId) {
			// Prepare metadata with reply information if replying
			const metadata = {};
			if (replyToMessage || replyingTo) {
				const replyMsg = replyToMessage || replyingTo;
				metadata.replyTo = {
					messageId: replyMsg._id || replyMsg.id,
					content: replyMsg.content || replyMsg.text || '',
					senderId: replyMsg.senderId || replyMsg.sender?._id,
					senderName: replyMsg.sender?.firstName || replyMsg.sender?.name || replyMsg.senderName || 'User'
				};
			}

			sendMessage(
				selectedChatId,
				messageInput.trim(),
				'text',
				null,
				false,
				null,
				metadata
			);
			setMessageInput('');
			setReplyingTo(null); // Clear reply state after sending

			if (isMobile && inputRef.current) {
				inputRef.current.focus();
			}
		}
	}, [messageInput, selectedChatId, sendMessage, isMobile, replyingTo]);

	// NEW: Handle reply action
	const handleReplyMessage = useCallback((message) => {
		setReplyingTo(message);
		setEditingMessage(null); // Can't edit and reply at same time
		if (inputRef.current) {
			inputRef.current.focus();
		}
	}, []);

	// NEW: Handle edit action
	const handleEditMessage = useCallback((message) => {
		setEditingMessage(message);
		setReplyingTo(null); // Can't edit and reply at same time
		// Input content will be set by ChatMessageInput component
	}, []);

	useEffect(() => {
		const handleKeyDown = (e) => {
			if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
				e.preventDefault();
				inputRef.current?.focus();
			}

			if (e.key === 'Escape') {
				if (showEmojiPicker) {
					setShowEmojiPicker(false);
				} else if (editingMessage) {
					setEditingMessage(null);
					setMessageInput('');
				} else if (replyingTo) {
					setReplyingTo(null);
				}
			}
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	}, [showEmojiPicker, editingMessage, replyingTo]);

	if (!currentUser) {
		return <SignInPlaceholder />;
	}

	if (!selectedChatId) {
		if (isMobile) {
			return null;
		}
		return <NoChatSelectedPlaceholder />;
	}

	// WhatsApp-style mobile layout: Fixed header, scrollable messages, fixed input
	if (isMobile) {
		return (
			<div className="flex flex-col h-full w-full overflow-hidden">
				{/* Fixed Header */}
				<div className="flex-shrink-0 w-full">
					<ChatHeader
						selectedChat={selectedChat}
						chatName={chatName}
						chatAvatar={chatAvatar}
						isUserOnline={isUserOnline}
						isGroupChat={isGroupChat}
						isTyping={isTyping}
						isMobile={isMobile}
					/>
				</div>

				{/* Scrollable Messages Area - This is the only scrollable part */}
				<div className="flex-1 min-h-0 w-full overflow-hidden">
					<ChatMessagesPanel
						currentMessages={currentMessages}
						currentUser={currentUser}
						selectedChat={selectedChat}
						contacts={contacts}
						isGroupChat={isGroupChat}
						loadingMessages={loadingMessages}
						messagesContainerRef={messagesContainerRef}
						messagesEndRef={messagesEndRef}
						handleScroll={handleScroll}
						scrollToBottom={scrollToBottom}
						showScrollButton={showScrollButton}
						isTyping={isTyping}
						typingText={typingText}
						isMobile={isMobile}
						onEditMessage={handleEditMessage}
						onReplyMessage={handleReplyMessage}
						editingMessage={editingMessage}
						replyingTo={replyingTo}
					/>
				</div>

				{/* Fixed Input Area */}
				<div className="flex-shrink-0 w-full">
					<ChatMessageInput
						messageInput={messageInput}
						setMessageInput={setMessageInput}
						handleSendMessage={handleSendMessage}
						inputRef={inputRef}
						showEmojiPicker={showEmojiPicker}
						setShowEmojiPicker={setShowEmojiPicker}
						conversationId={selectedChat?.conversationId}
						editingMessage={editingMessage}
						setEditingMessage={setEditingMessage}
						replyingTo={replyingTo}
						setReplyingTo={setReplyingTo}
					/>
				</div>
			</div>
		);
	}

	// Desktop layout: normal flex layout
	return (
		<div className="flex-1 flex flex-col h-full relative">
			<ChatHeader
				selectedChat={selectedChat}
				chatName={chatName}
				chatAvatar={chatAvatar}
				isUserOnline={isUserOnline}
				isGroupChat={isGroupChat}
				isTyping={isTyping}
				isMobile={isMobile}
			/>

			<ChatMessagesPanel
				currentMessages={currentMessages}
				currentUser={currentUser}
				selectedChat={selectedChat}
				contacts={contacts}
				isGroupChat={isGroupChat}
				loadingMessages={loadingMessages}
				messagesContainerRef={messagesContainerRef}
				messagesEndRef={messagesEndRef}
				handleScroll={handleScroll}
				scrollToBottom={scrollToBottom}
				showScrollButton={showScrollButton}
				isTyping={isTyping}
				typingText={typingText}
				isMobile={isMobile}
				onEditMessage={handleEditMessage}
				onReplyMessage={handleReplyMessage}
				editingMessage={editingMessage}
				replyingTo={replyingTo}
			/>

			<ChatMessageInput
				messageInput={messageInput}
				setMessageInput={setMessageInput}
				handleSendMessage={handleSendMessage}
				inputRef={inputRef}
				showEmojiPicker={showEmojiPicker}
				setShowEmojiPicker={setShowEmojiPicker}
				conversationId={selectedChat?.conversationId}
				editingMessage={editingMessage}
				setEditingMessage={setEditingMessage}
				replyingTo={replyingTo}
				setReplyingTo={setReplyingTo}
			/>
		</div>
	);
}

export default memo(ChatMainPanel);