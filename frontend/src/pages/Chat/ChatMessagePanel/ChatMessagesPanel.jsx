import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Loader2, ArrowDown, ArrowUp, Check, CheckCheck, Clock, Reply, Copy, Forward, Star, Pin, Trash2, CheckSquare, Share2, Info, Edit3, Smile, XCircle, RotateCcw } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { toast } from 'sonner';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useMessageStore } from '@/store/messageStore';
import { useContactsStore } from '@/store/contactsStore';
import { formatTimeSafe, formatDateSeparator, isSameDaySafe, shouldGroupMessage, getInitials, getMessageDisplayName, getMessageAvatar, isValidMessage, getMessageContent, getAvatarGradient } from '@/utils/helpers';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const EDIT_TIME_LIMIT_MINUTES = 15;
const LOAD_MORE_THRESHOLD = 200; // pixels from top to trigger load more

// Message bubble component - memoized for performance
const MessageBubble = memo(({
	message,
	currentUser,
	isGroupChat,
	isLastInGroup,
	selectedChat,
	contacts,
	onReply,
	onEdit,
	onDelete,
	onForward,
	onCopy,
	onReaction,
	onInfo,
	onRetry
}) => {
	const [showReactionPicker, setShowReactionPicker] = useState(false);
	const [showQuickReactions, setShowQuickReactions] = useState(false);
	const [isHovering, setIsHovering] = useState(false);
	const reactionPickerRef = useRef(null);
	const messageRef = useRef(null);

	const isCurrentUserMessage = message.sender?._id === currentUser?._id ||
		message.sender === currentUser?._id ||
		message.senderId === currentUser?._id;

	const getMessageStatusIcon = () => {
		if (!isCurrentUserMessage) return null;

		const status = message.status || message.deliveryStatus;

		switch (status) {
			case 'sending':
				return <Clock className="h-3 w-3 opacity-60 animate-pulse" />;
			case 'sent':
				return <Check className="h-3 w-3 opacity-60" />;
			case 'delivered':
				return <CheckCheck className="h-3 w-3 opacity-60" />;
			case 'read':
				return <CheckCheck className="h-3 w-3 text-blue-500" />;
			case 'failed':
				return <XCircle className="h-3 w-3 text-red-500" />;
			default:
				return <Clock className="h-3 w-3 opacity-60" />;
		}
	};

	const renderMessageAvatar = () => {
		if (!isGroupChat || !isLastInGroup) return null;

		const avatarInfo = getMessageAvatar(message, selectedChat, contacts);
		if (!avatarInfo) return null;

		return (
			<Avatar className="w-8 h-8 mr-2 flex-shrink-0">
				<AvatarImage src={avatarInfo.src} alt={avatarInfo.name} />
				<AvatarFallback className={`bg-gradient-to-br ${getAvatarGradient(message.senderId)} text-white text-xs`}>
					{getInitials(avatarInfo.name)}
				</AvatarFallback>
			</Avatar>
		);
	};

	const renderReactions = () => {
		if (!message.reactions || message.reactions.length === 0) return null;

		const reactionGroups = message.reactions.reduce((acc, reaction) => {
			if (!acc[reaction.emoji]) {
				acc[reaction.emoji] = [];
			}
			const userId = reaction.user?._id || reaction.user;
			acc[reaction.emoji].push(userId);
			return acc;
		}, {});

		return (
			<div className="flex flex-wrap gap-1 mt-1">
				{Object.entries(reactionGroups).map(([emoji, users]) => {
					const hasCurrentUserReacted = users.some(
						(userId) => userId?.toString() === currentUser._id?.toString()
					);

					return (
						<button
							key={emoji}
							onClick={() => onReaction(message._id || message.id, emoji, hasCurrentUserReacted)}
							className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all ${hasCurrentUserReacted
								? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700'
								: 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
								} hover:scale-110`}
						>
							<span>{emoji}</span>
							{users.length > 1 && <span className="text-gray-600 dark:text-gray-400">{users.length}</span>}
						</button>
					);
				})}
			</div>
		);
	};

	const handleQuickReaction = (emoji) => {
		const hasReacted = message.reactions?.some(
			r => r.emoji === emoji && (r.user?._id === currentUser._id || r.user === currentUser._id)
		);
		onReaction(message._id || message.id, emoji, hasReacted);
		setShowQuickReactions(false);
	};

	useEffect(() => {
		const handleClickOutside = (event) => {
			if (reactionPickerRef.current && !reactionPickerRef.current.contains(event.target)) {
				setShowReactionPicker(false);
			}
		};

		if (showReactionPicker) {
			document.addEventListener('mousedown', handleClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, [showReactionPicker]);

	const renderRepliedMessage = () => {
		if (!message.metadata?.repliedTo) return null;

		const repliedMsg = message.metadata.repliedTo;
		return (
			<div className="mb-2 p-2 border-l-4 border-green-500 bg-gray-100 dark:bg-gray-800 rounded">
				<p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
					{repliedMsg.senderName || 'Unknown'}
				</p>
				<p className="text-xs text-gray-500 dark:text-gray-500 truncate">
					{repliedMsg.content || 'Message'}
				</p>
			</div>
		);
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger asChild>
				<div
					ref={messageRef}
					className={`flex ${message.type === 'sent' ? 'justify-end' : 'justify-start'} group relative`}
					onMouseEnter={() => {
						setIsHovering(true);
						setShowQuickReactions(true);
					}}
					onMouseLeave={() => {
						setIsHovering(false);
						setShowQuickReactions(false);
					}}
				>
					{message.type === 'received' && renderMessageAvatar()}

					<div className="relative max-w-[85%] sm:max-w-[70%]">
						<div
							className={`px-3 py-2 sm:px-4 sm:py-3 rounded-2xl shadow-sm ${message.status === 'failed'
								? 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100 border border-red-300 dark:border-red-700'
								: message.type === 'sent'
									? `bg-green-500 text-white ${isLastInGroup ? 'rounded-br-md' : ''}`
									: `bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${isLastInGroup ? 'rounded-bl-md' : ''}`
								}`}
						>
							{renderRepliedMessage()}

							<p className="break-words whitespace-pre-wrap leading-relaxed">
								{message.isDeleted ? (
									<span className="italic opacity-60">{getMessageContent(message)}</span>
								) : (
									getMessageContent(message)
								)}
							</p>

							{message.isEdited && !message.isDeleted && (
								<span className="text-xs opacity-60 ml-2">edited</span>
							)}

							<div className={`flex items-center justify-end space-x-1 mt-1 ${message.status === 'failed'
								? 'text-red-600 dark:text-red-400'
								: message.type === 'sent'
									? 'text-green-100'
									: 'text-gray-500 dark:text-gray-400'
								}`}>
								<span className="text-xs">
									{formatTimeSafe(message.time || message.createdAt)}
								</span>
								{(message.type === 'sent' || isCurrentUserMessage) && (
									<div className="flex items-center">
										{getMessageStatusIcon()}
									</div>
								)}
							</div>

							{message.status === 'failed' && (
								<div className="mt-2 pt-2 border-t border-red-300 dark:border-red-700">
									<button
										onClick={() => onRetry(message._id || message.id, message.conversationId)}
										className="flex items-center gap-1 text-xs text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100"
									>
										<RotateCcw className="h-3 w-3" />
										Retry
									</button>
								</div>
							)}
						</div>

						{renderReactions()}

						{showQuickReactions && isHovering && !message.isDeleted && (
							<div className={`absolute ${message.type === 'sent' ? 'right-0' : 'left-0'} -top-10 bg-white dark:bg-gray-800 shadow-lg rounded-full px-2 py-1 flex gap-1 border border-gray-200 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity z-10`}>
								{QUICK_REACTIONS.map((emoji) => (
									<button
										key={emoji}
										onClick={() => handleQuickReaction(emoji)}
										className="hover:scale-125 transition-transform text-xl p-1"
										title={`React with ${emoji}`}
									>
										{emoji}
									</button>
								))}
								<button
									onClick={() => setShowReactionPicker(true)}
									className="hover:scale-125 transition-transform p-1"
									title="More reactions"
								>
									<Smile className="h-5 w-5 text-gray-500" />
								</button>
							</div>
						)}

						{showReactionPicker && (
							<div
								ref={reactionPickerRef}
								className={`absolute ${message.type === 'sent' ? 'right-0' : 'left-0'} top-0 z-50`}
							>
								<EmojiPicker
									onEmojiClick={(emojiData) => {
										handleQuickReaction(emojiData.emoji);
										setShowReactionPicker(false);
									}}
									theme="auto"
									previewConfig={{ showPreview: false }}
									searchDisabled={false}
									skinTonesDisabled={true}
									width={320}
									height={400}
								/>
							</div>
						)}
					</div>
				</div>
			</ContextMenuTrigger>

			<ContextMenuContent className="w-56">
				{!message.isDeleted && (
					<>
						<ContextMenuItem onClick={() => onReply(message)}>
							<Reply className="mr-2 h-4 w-4" />
							Reply
						</ContextMenuItem>
						<ContextMenuItem onClick={() => onCopy(message)}>
							<Copy className="mr-2 h-4 w-4" />
							Copy
						</ContextMenuItem>
						<ContextMenuItem onClick={() => onForward(message)}>
							<Forward className="mr-2 h-4 w-4" />
							Forward
						</ContextMenuItem>
						<ContextMenuItem>
							<Star className="mr-2 h-4 w-4" />
							Star
						</ContextMenuItem>
						<ContextMenuItem>
							<Pin className="mr-2 h-4 w-4" />
							Pin
						</ContextMenuItem>
					</>
				)}

				{isCurrentUserMessage && !message.isDeleted && message.status !== 'failed' && (
					<>
						<ContextMenuSeparator />
						<ContextMenuItem onClick={() => onEdit(message)}>
							<Edit3 className="mr-2 h-4 w-4" />
							Edit
						</ContextMenuItem>
					</>
				)}

				<ContextMenuSeparator />
				<ContextMenuItem onClick={() => onDelete(message, false)}>
					<Trash2 className="mr-2 h-4 w-4" />
					Delete for me
				</ContextMenuItem>

				{isCurrentUserMessage && !message.isDeleted && (
					<ContextMenuItem onClick={() => onDelete(message, true)}>
						<Trash2 className="mr-2 h-4 w-4 text-red-500" />
						<span className="text-red-500">Delete for everyone</span>
					</ContextMenuItem>
				)}

				{message.status === 'failed' && (
					<>
						<ContextMenuSeparator />
						<ContextMenuItem onClick={() => onRetry(message._id || message.id, message.conversationId)}>
							<RotateCcw className="mr-2 h-4 w-4" />
							Retry Send
						</ContextMenuItem>
					</>
				)}

				<ContextMenuSeparator />
				<ContextMenuItem>
					<CheckSquare className="mr-2 h-4 w-4" />
					Select
				</ContextMenuItem>
				<ContextMenuItem>
					<Share2 className="mr-2 h-4 w-4" />
					Share
				</ContextMenuItem>
				<ContextMenuItem onClick={() => onInfo(message)}>
					<Info className="mr-2 h-4 w-4" />
					Info
				</ContextMenuItem>
			</ContextMenuContent>
		</ContextMenu>
	);
});

MessageBubble.displayName = 'MessageBubble';

// Main component
function ChatMessagesPanel({
	currentMessages,
	currentUser,
	selectedChat,
	contacts,
	isGroupChat,
	loadingMessages,
	messagesContainerRef,
	messagesEndRef,
	handleScroll,
	scrollToBottom,
	showScrollButton,
	isTyping,
	typingText,
	isMobile
}) {
	const typingIndicatorRef = useRef(null);
	const topObserverRef = useRef(null);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [showLoadMoreButton, setShowLoadMoreButton] = useState(false);

	// Message actions state
	const [editingMessage, setEditingMessage] = useState(null);
	const [editContent, setEditContent] = useState('');
	const [forwardingMessage, setForwardingMessage] = useState(null);
	const [selectedContacts, setSelectedContacts] = useState([]);
	const [messageInfo, setMessageInfo] = useState(null);
	const [replyingTo, setReplyingTo] = useState(null);
	const [deletingMessage, setDeletingMessage] = useState(null);
	const [deleteForEveryone, setDeleteForEveryone] = useState(false);

	// Store actions
	const {
		editMessage,
		deleteMessage,
		addReaction,
		removeReaction,
		forwardMessage,
		retryFailedMessage,
		loadMoreMessages,
		hasMoreMessages,
		getMessagePagination
	} = useMessageStore();
	const { dmContacts, fetchDmContacts } = useContactsStore();

	// Get pagination info
	const conversationId = selectedChat?.conversationId;
	const paginationInfo = conversationId ? getMessagePagination(conversationId) : null;
	const hasMore = conversationId ? hasMoreMessages(conversationId) : false;

	// Fetch contacts on mount
	useEffect(() => {
		fetchDmContacts();
	}, [fetchDmContacts]);

	// Auto-scroll to typing indicator
	useEffect(() => {
		if (isTyping && typingIndicatorRef.current) {
			typingIndicatorRef.current.scrollIntoView({
				behavior: 'smooth',
				block: 'end'
			});
		}
	}, [isTyping]);

	// Handle load more messages
	const handleLoadMore = useCallback(async () => {
		if (!conversationId || isLoadingMore || !hasMore) {
			return;
		}

		setIsLoadingMore(true);

		try {
			// Save current scroll position
			const container = messagesContainerRef.current;
			if (!container) return;

			const scrollHeightBefore = container.scrollHeight;
			const scrollTopBefore = container.scrollTop;

			console.log('📜 Loading more messages...');
			await loadMoreMessages(conversationId);

			// Restore scroll position after new messages are added
			requestAnimationFrame(() => {
				if (container) {
					const scrollHeightAfter = container.scrollHeight;
					const heightDifference = scrollHeightAfter - scrollHeightBefore;
					container.scrollTop = scrollTopBefore + heightDifference;
					console.log('✅ Scroll position restored after loading older messages');
				}
			});

			toast.success('Loaded older messages');
		} catch (error) {
			console.error('Error loading more messages:', error);
			toast.error('Failed to load older messages');
		} finally {
			setIsLoadingMore(false);
		}
	}, [conversationId, isLoadingMore, hasMore, loadMoreMessages, messagesContainerRef]);

	// Detect when user scrolls near top
	useEffect(() => {
		const container = messagesContainerRef.current;
		if (!container) return;

		const handleScrollForLoadMore = () => {
			const scrollTop = container.scrollTop;
			const shouldShowButton = scrollTop < LOAD_MORE_THRESHOLD && hasMore;
			setShowLoadMoreButton(shouldShowButton);
		};

		container.addEventListener('scroll', handleScrollForLoadMore);
		return () => container.removeEventListener('scroll', handleScrollForLoadMore);
	}, [hasMore, messagesContainerRef]);

	// Handle reply
	const handleReply = useCallback((message) => {
		setReplyingTo(message);
		toast.info("Replying to message", {
			description: "Type your reply in the message input",
		});
	}, []);

	// Handle edit
	const handleEdit = useCallback((message) => {
		const messageTime = new Date(message.createdAt || message.time);
		const now = new Date();
		const diffMinutes = (now - messageTime) / (1000 * 60);

		if (diffMinutes > EDIT_TIME_LIMIT_MINUTES) {
			toast.error("Cannot edit message", {
				description: `Messages can only be edited within ${EDIT_TIME_LIMIT_MINUTES} minutes`,
			});
			return;
		}

		setEditingMessage(message);
		setEditContent(message.content || message.text || '');
	}, []);

	const handleEditSave = async () => {
		if (!editContent.trim()) {
			toast.error("Message cannot be empty");
			return;
		}

		if (!editingMessage) return;

		const messageId = editingMessage._id || editingMessage.id;

		if (!messageId) {
			toast.error("Invalid message data");
			return;
		}

		try {
			await editMessage(messageId, editContent);
			setEditingMessage(null);
			setEditContent('');
			toast.success("Message edited successfully");
		} catch (error) {
			console.error("Edit error:", error);
			toast.error("Failed to edit message", {
				description: error.message,
			});
		}
	};

	// Handle delete
	const handleDelete = useCallback((message, forEveryone = false) => {
		setDeletingMessage(message);
		setDeleteForEveryone(forEveryone);
	}, []);

	const confirmDelete = async () => {
		if (!deletingMessage) return;

		const messageId = deletingMessage._id || deletingMessage.id;
		const conversationId = deletingMessage.conversationId || selectedChat?.conversationId;

		if (!messageId || !conversationId) {
			toast.error("Invalid message data");
			setDeletingMessage(null);
			return;
		}

		try {
			await deleteMessage(
				messageId,
				conversationId,
				deleteForEveryone ? 'everyone' : 'me'
			);
			toast.success("Message deleted", {
				description: deleteForEveryone ? "Message deleted for everyone" : "Message deleted for you",
			});
		} catch (error) {
			console.error("Delete error:", error);
			toast.error("Failed to delete message", {
				description: error.message,
			});
		} finally {
			setDeletingMessage(null);
			setDeleteForEveryone(false);
		}
	};

	// Handle forward
	const handleForward = useCallback((message) => {
		setForwardingMessage(message);
		setSelectedContacts([]);
	}, []);

	const handleForwardSend = async () => {
		if (selectedContacts.length === 0) {
			toast.error("Please select at least one contact");
			return;
		}

		if (!forwardingMessage) return;

		const messageId = forwardingMessage._id || forwardingMessage.id;

		if (!messageId) {
			toast.error("Invalid message data");
			return;
		}

		try {
			const conversationIds = selectedContacts.map(c => c.conversationId);
			await forwardMessage(messageId, conversationIds);
			setForwardingMessage(null);
			setSelectedContacts([]);
			toast.success("Message forwarded", {
				description: `Forwarded to ${selectedContacts.length} contact(s)`,
			});
		} catch (error) {
			console.error("Forward error:", error);
			toast.error("Failed to forward message", {
				description: error.message,
			});
		}
	};

	// Handle copy
	const handleCopy = useCallback((message) => {
		const content = message.content || message.text || '';
		if (content) {
			navigator.clipboard.writeText(content);
			toast.success("Copied to clipboard");
		}
	}, []);

	// Handle reaction
	const handleReaction = useCallback(async (messageId, emoji, hasReacted) => {
		if (!messageId || !emoji) return;

		const conversationId = selectedChat?.conversationId;
		if (!conversationId) {
			toast.error("No conversation selected");
			return;
		}

		try {
			if (hasReacted) {
				await removeReaction(messageId, conversationId, emoji);
			} else {
				await addReaction(messageId, conversationId, emoji);
			}
		} catch (error) {
			console.error("Reaction error:", error);
			toast.error("Failed to react", {
				description: error.message,
			});
		}
	}, [addReaction, removeReaction, selectedChat]);

	// Handle retry
	const handleRetry = useCallback(async (messageId, conversationId) => {
		if (!messageId || !conversationId) {
			toast.error("Invalid message data");
			return;
		}

		try {
			await retryFailedMessage(messageId, conversationId);
			toast.info("Retrying message...");
		} catch (error) {
			console.error("Retry error:", error);
			toast.error("Failed to retry message", {
				description: error.message,
			});
		}
	}, [retryFailedMessage]);

	// Handle info
	const handleInfo = useCallback((message) => {
		setMessageInfo(message);
	}, []);

	const renderSenderName = (message, isGrouped) => {
		if (!isGroupChat || isGrouped) return null;

		const displayName = getMessageDisplayName(message, selectedChat, contacts);
		if (!displayName) return null;

		return (
			<div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 ml-10">
				{displayName}
			</div>
		);
	};

	return (
		<>
			<div className="flex-1 flex flex-col min-h-0">
				<div
					ref={messagesContainerRef}
					onScroll={handleScroll}
					className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 bg-gray-50 dark:bg-gray-900"
					style={{
						backgroundImage: isMobile ? 'none' : `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f0f0f0' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
						minHeight: '0',
						maxHeight: '100%'
					}}
				>
					{loadingMessages ? (
						<div className="flex flex-col items-center justify-center h-full min-h-32">
							<Loader2 className="w-8 h-8 animate-spin mb-2 text-gray-400" />
							<p className="text-gray-500 dark:text-gray-400">Loading messages...</p>
						</div>
					) : currentMessages.length === 0 ? (
						<div className="flex items-center justify-center h-full min-h-32">
							<p className="text-gray-500 dark:text-gray-400">No messages yet. Say hello!</p>
						</div>
					) : (
						<div className="space-y-1 pb-4">
							{/* Load More Button at top */}
							{showLoadMoreButton && hasMore && (
								<div className="flex justify-center py-2" ref={topObserverRef}>
									<Button
										onClick={handleLoadMore}
										disabled={isLoadingMore}
										variant="outline"
										size="sm"
										className="gap-2"
									>
										{isLoadingMore ? (
											<>
												<Loader2 className="h-4 w-4 animate-spin" />
												Loading...
											</>
										) : (
											<>
												<ArrowUp className="h-4 w-4" />
												Load Older Messages
												{paginationInfo && (
													<span className="text-xs text-gray-500">
														({paginationInfo.page}/{paginationInfo.totalPages})
													</span>
												)}
											</>
										)}
									</Button>
								</div>
							)}

							{/* Loading indicator when loading more */}
							{isLoadingMore && !showLoadMoreButton && (
								<div className="flex justify-center py-2">
									<Loader2 className="h-5 w-5 animate-spin text-gray-400" />
								</div>
							)}

							{currentMessages.map((message, index) => {
								if (!isValidMessage(message, index)) return null;

								const prevMessage = currentMessages[index - 1];
								const nextMessage = currentMessages[index + 1];

								const isGrouped = shouldGroupMessage(message, prevMessage);
								const isLastInGroup = !shouldGroupMessage(nextMessage, message);

								const showDate = !prevMessage || !isSameDaySafe(
									message.time || message.createdAt,
									prevMessage.time || prevMessage.createdAt
								);

								return (
									<React.Fragment key={message.messageId || message.id || message._id || `message-${index}`}>
										{showDate && (message.time || message.createdAt) && (
											<div className="flex justify-center my-4">
												<span className="px-3 py-1 bg-white dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 rounded-full shadow-sm border border-gray-200 dark:border-gray-700">
													{formatDateSeparator(message.time || message.createdAt)}
												</span>
											</div>
										)}

										{renderSenderName(message, isGrouped)}

										<div className={isGrouped ? 'mt-1' : 'mt-2'}>
											<MessageBubble
												message={message}
												currentUser={currentUser}
												isGroupChat={isGroupChat}
												isLastInGroup={isLastInGroup}
												selectedChat={selectedChat}
												contacts={contacts}
												onReply={handleReply}
												onEdit={handleEdit}
												onDelete={handleDelete}
												onForward={handleForward}
												onCopy={handleCopy}
												onReaction={handleReaction}
												onInfo={handleInfo}
												onRetry={handleRetry}
											/>
										</div>
									</React.Fragment>
								);
							})}

							{/* Typing Indicator */}
							{isTyping && typingText && (
								<div ref={typingIndicatorRef} className="flex justify-start mt-2">
									{isGroupChat && <div className="w-8 h-8 mr-2 flex-shrink-0" />}
									<div className="flex items-center bg-white dark:bg-gray-800 rounded-2xl rounded-bl-md px-3 py-2.5 shadow-sm border border-gray-100 dark:border-gray-700 max-w-[75%] sm:max-w-[65%]">
										<div className="flex space-x-1 mr-2.5">
											{[0, 150, 300].map((delay) => (
												<div
													key={delay}
													className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full animate-bounce"
													style={{ animationDelay: `${delay}ms`, animationDuration: '0.8s' }}
												/>
											))}
										</div>
										<span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
											{typingText}
										</span>
									</div>
								</div>
							)}

							<div ref={messagesEndRef} />
						</div>
					)}
				</div>

				{/* Scroll to bottom button */}
				{showScrollButton && (
					<button
						onClick={() => scrollToBottom('smooth')}
						className="absolute z-10 w-12 h-12 bg-white dark:bg-gray-700 shadow-lg rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-600 hover:shadow-xl transform hover:scale-105 transition-all duration-200 bottom-22 left-1/2 -translate-x-1/2"
						aria-label="Scroll to bottom"
					>
						<ArrowDown className="h-6 w-6 text-gray-600 dark:text-gray-300" />
					</button>
				)}
			</div>

			{/* Edit Message Dialog */}
			<Dialog open={!!editingMessage} onOpenChange={(open) => !open && setEditingMessage(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Message</DialogTitle>
						<DialogDescription>
							Make changes to your message. You can only edit messages within {EDIT_TIME_LIMIT_MINUTES} minutes of sending.
						</DialogDescription>
					</DialogHeader>
					<Textarea
						value={editContent}
						onChange={(e) => setEditContent(e.target.value)}
						placeholder="Edit your message..."
						className="min-h-[100px]"
						autoFocus
					/>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingMessage(null)}>
							Cancel
						</Button>
						<Button onClick={handleEditSave} disabled={!editContent.trim()}>
							Save Changes
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog open={!!deletingMessage} onOpenChange={(open) => !open && setDeletingMessage(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete Message</DialogTitle>
						<DialogDescription>
							{deleteForEveryone
								? "This message will be deleted for everyone in the conversation. This action cannot be undone."
								: "This message will only be deleted for you. Other participants will still see it."
							}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeletingMessage(null)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={confirmDelete}>
							Delete {deleteForEveryone && "for Everyone"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Forward Message Dialog */}
			<Dialog open={!!forwardingMessage} onOpenChange={(open) => !open && setForwardingMessage(null)}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Forward Message To</DialogTitle>
						<DialogDescription>
							Select one or more contacts to forward this message to.
						</DialogDescription>
					</DialogHeader>
					<ScrollArea className="h-[300px] pr-4">
						{dmContacts && dmContacts.length > 0 ? (
							dmContacts.map((contact) => (
								<div
									key={contact._id}
									onClick={() => {
										setSelectedContacts(prev =>
											prev.find(c => c._id === contact._id)
												? prev.filter(c => c._id !== contact._id)
												: [...prev, contact]
										);
									}}
									className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${selectedContacts.find(c => c._id === contact._id)
										? 'bg-green-50 dark:bg-green-900/20'
										: ''
										}`}
								>
									<Avatar>
										<AvatarImage src={contact.image} />
										<AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-500 text-white">
											{getInitials(contact.name || contact.username)}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1">
										<p className="font-medium text-sm">{contact.name || contact.username}</p>
										<p className="text-xs text-gray-500">{contact.email}</p>
									</div>
									{selectedContacts.find(c => c._id === contact._id) && (
										<Check className="h-5 w-5 text-green-500" />
									)}
								</div>
							))
						) : (
							<div className="flex items-center justify-center h-32 text-gray-500">
								<p>No contacts available</p>
							</div>
						)}
					</ScrollArea>
					<DialogFooter>
						<Button variant="outline" onClick={() => setForwardingMessage(null)}>
							Cancel
						</Button>
						<Button
							onClick={handleForwardSend}
							disabled={selectedContacts.length === 0}
						>
							Forward ({selectedContacts.length})
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Message Info Dialog */}
			<Dialog open={!!messageInfo} onOpenChange={(open) => !open && setMessageInfo(null)}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Message Info</DialogTitle>
						<DialogDescription>
							Detailed information about this message
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</p>
							<div className="flex items-center gap-2">
								{messageInfo?.status === 'read' && <CheckCheck className="h-4 w-4 text-blue-500" />}
								{messageInfo?.status === 'delivered' && <CheckCheck className="h-4 w-4 text-gray-400" />}
								{messageInfo?.status === 'sent' && <Check className="h-4 w-4 text-gray-400" />}
								{messageInfo?.status === 'sending' && <Clock className="h-4 w-4 text-gray-400" />}
								{messageInfo?.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
								<span className="text-sm capitalize">
									{messageInfo?.status || messageInfo?.deliveryStatus || 'Unknown'}
								</span>
							</div>
						</div>

						<div>
							<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Sent</p>
							<p className="text-sm">
								{messageInfo?.createdAt && new Date(messageInfo.createdAt).toLocaleString('en-US', {
									weekday: 'short',
									year: 'numeric',
									month: 'short',
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit',
									second: '2-digit'
								})}
							</p>
						</div>

						{messageInfo?.isEdited && messageInfo?.editedAt && (
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Edited</p>
								<p className="text-sm">
									{new Date(messageInfo.editedAt).toLocaleString('en-US', {
										weekday: 'short',
										year: 'numeric',
										month: 'short',
										day: 'numeric',
										hour: '2-digit',
										minute: '2-digit',
										second: '2-digit'
									})}
								</p>
							</div>
						)}

						{messageInfo?.readBy && messageInfo.readBy.length > 0 && (
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
									Read By ({messageInfo.readBy.length})
								</p>
								<ScrollArea className="max-h-[200px] border rounded-md">
									<div className="p-2">
										{messageInfo.readBy.map((receipt, idx) => {
											const userName = typeof receipt.user === 'object'
												? receipt.user?.name || receipt.user?.username || 'User'
												: 'User';
											const readTime = receipt.readAt;

											return (
												<div key={idx} className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
													<div className="flex items-center gap-2">
														<Avatar className="h-8 w-8">
															<AvatarImage src={typeof receipt.user === 'object' ? receipt.user?.image : null} />
															<AvatarFallback className="text-xs">
																{getInitials(userName)}
															</AvatarFallback>
														</Avatar>
														<span className="text-sm font-medium">{userName}</span>
													</div>
													<span className="text-xs text-gray-500">
														{readTime && new Date(readTime).toLocaleString('en-US', {
															month: 'short',
															day: 'numeric',
															hour: '2-digit',
															minute: '2-digit'
														})}
													</span>
												</div>
											);
										})}
									</div>
								</ScrollArea>
								<p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
									{messageInfo.readBy.length === 1
										? '1 person has read this message'
										: `${messageInfo.readBy.length} people have read this message`
									}
								</p>
							</div>
						)}

						{messageInfo?.reactions && messageInfo.reactions.length > 0 && (
							<div>
								<p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
									Reactions ({messageInfo.reactions.length})
								</p>
								<div className="flex flex-wrap gap-2">
									{messageInfo.reactions.map((reaction, idx) => (
										<div key={idx} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
											<span>{reaction.emoji}</span>
											<span className="text-xs text-gray-600 dark:text-gray-400">
												{typeof reaction.user === 'object'
													? reaction.user?.name || reaction.user?.username || 'User'
													: 'User'
												}
											</span>
										</div>
									))}
								</div>
							</div>
						)}

						{messageInfo?.isForwarded && (
							<div className="flex items-center gap-2 text-sm text-gray-500">
								<Forward className="h-4 w-4" />
								<span>Forwarded message</span>
							</div>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

export default memo(ChatMessagesPanel);