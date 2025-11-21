import React, { useEffect, useRef, useState, useCallback, memo, lazy } from 'react';
import { Loader2, ArrowDown, ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { useMessageStore } from '@/store/messageStore';
import { useContactsStore } from '@/store/contactsStore';
import { formatDateSeparator, isSameDaySafe, shouldGroupMessage, isValidMessage, getMessageDisplayName } from '@/utils/helpers';

// Import split components
const MessageBubble = lazy(() => import('@/components/MessageBubble'));
const MessageActions = lazy(() => import('@/components/MessageActions'));

const LOAD_MORE_THRESHOLD = 200;

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
	isMobile,
	// Props for edit/reply functionality
	onEditMessage,
	onReplyMessage,
	editingMessage,
	replyingTo
}) {
	const typingIndicatorRef = useRef(null);
	const topObserverRef = useRef(null);
	const messageRefs = useRef({}); // Store refs for each message
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [showLoadMoreButton, setShowLoadMoreButton] = useState(false);
	const [highlightedMessageId, setHighlightedMessageId] = useState(null);
	const [isSearchingMessage, setIsSearchingMessage] = useState(false);

	// Message actions state
	const [forwardingMessage, setForwardingMessage] = useState(null);
	const [selectedContacts, setSelectedContacts] = useState([]);
	const [messageInfo, setMessageInfo] = useState(null);
	const [messageAnchor, setMessageAnchor] = useState(null); // NEW: Anchor for popover
	const [deletingMessage, setDeletingMessage] = useState(null);
	const [deleteForEveryone, setDeleteForEveryone] = useState(false);
	const [longPressedMessage, setLongPressedMessage] = useState(null);

	// Store actions
	const {
		deleteMessage,
		addReaction,
		removeReaction,
		forwardMessage,
		retryFailedMessage,
		loadMoreMessages,
		hasMoreMessages,
		getMessagePagination,
		setReplyingTo,
		clearReplyingTo,
		getMessageById,
		getMessageByIdWithLoad,
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
			const container = messagesContainerRef.current;
			if (!container) return;

			const scrollHeightBefore = container.scrollHeight;
			const scrollTopBefore = container.scrollTop;

			await loadMoreMessages(conversationId);

			requestAnimationFrame(() => {
				if (container) {
					const scrollHeightAfter = container.scrollHeight;
					const heightDifference = scrollHeightAfter - scrollHeightBefore;
					container.scrollTop = scrollTopBefore + heightDifference;
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

	// NEW: Enhanced scroll to message with automatic loading
	const scrollToMessage = useCallback(async (messageId) => {
		if (!messageId || !conversationId) {
			toast.error('Invalid message reference');
			return;
		}

		console.log(`🎯 Attempting to scroll to message: ${messageId}`);

		// First check if message is already in DOM
		const messageElement = messageRefs.current[messageId];
		if (messageElement) {
			console.log('✅ Message found in DOM, scrolling...');
			messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

			// Highlight the message
			setHighlightedMessageId(messageId);
			setTimeout(() => {
				setHighlightedMessageId(null);
			}, 3000); // 3 seconds as requested
			return;
		}

		// Message not in DOM - check if it exists in loaded messages
		const message = getMessageById(messageId, conversationId);
		if (message) {
			console.log('⚠️ Message loaded but not in DOM yet, waiting...');
			// Message is loaded but DOM not updated yet, wait a bit
			setTimeout(() => {
				const element = messageRefs.current[messageId];
				if (element) {
					element.scrollIntoView({ behavior: 'smooth', block: 'center' });
					setHighlightedMessageId(messageId);
					setTimeout(() => setHighlightedMessageId(null), 3000);
				} else {
					toast.info('Message not visible. Scroll up to load older messages.');
				}
			}, 300);
			return;
		}

		// Message not loaded - need to load more pages
		console.log('📜 Message not loaded, attempting to load pages...');
		setIsSearchingMessage(true);

		const loadingToast = toast.loading('Searching for message...');

		try {
			const result = await getMessageByIdWithLoad(conversationId, messageId);

			toast.dismiss(loadingToast);

			if (result.found) {
				console.log('✅ Message found after loading pages');
				toast.success('Message found!');

				// Wait for DOM to update
				setTimeout(() => {
					const element = messageRefs.current[messageId];
					if (element) {
						element.scrollIntoView({ behavior: 'smooth', block: 'center' });
						setHighlightedMessageId(messageId);
						setTimeout(() => setHighlightedMessageId(null), 3000);
					} else {
						// One more retry after a longer delay
						setTimeout(() => {
							const retryElement = messageRefs.current[messageId];
							if (retryElement) {
								retryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
								setHighlightedMessageId(messageId);
								setTimeout(() => setHighlightedMessageId(null), 3000);
							}
						}, 500);
					}
				}, 300);
			} else {
				console.log('❌ Message not found after loading all available pages');
				if (result.error) {
					toast.error('Error loading messages');
				} else {
					toast.info('Original message not found in this conversation');
				}
			}
		} catch (error) {
			console.error('Error searching for message:', error);
			toast.dismiss(loadingToast);
			toast.error('Failed to load message');
		} finally {
			setIsSearchingMessage(false);
		}
	}, [conversationId, getMessageById, getMessageByIdWithLoad]);

	// NEW: Enhanced reply handler - integrates with store
	const handleReply = useCallback((message) => {
		if (onReplyMessage) {
			// Set reply in store
			setReplyingTo(message);
			// Call parent handler (for UI updates)
			onReplyMessage(message);
			toast.info("Replying to message");
		}
	}, [onReplyMessage, setReplyingTo]);

	// NEW: Clear reply when needed
	const handleClearReply = useCallback(() => {
		clearReplyingTo();
		if (onReplyMessage) {
			onReplyMessage(null); // Clear in parent component too
		}
	}, [clearReplyingTo, onReplyMessage]);

	// Handle edit
	const handleEdit = useCallback((message) => {
		const EDIT_TIME_LIMIT_MINUTES = 15;
		const messageTime = new Date(message.createdAt || message.time);
		const now = new Date();
		const diffMinutes = (now - messageTime) / (1000 * 60);

		if (diffMinutes > EDIT_TIME_LIMIT_MINUTES) {
			toast.error(`Messages can only be edited within ${EDIT_TIME_LIMIT_MINUTES} minutes`);
			return;
		}

		if (onEditMessage) {
			onEditMessage(message);
		}
	}, [onEditMessage]);

	// Handle delete with reply consideration
	const handleDelete = useCallback((message, forEveryone = false) => {
		// Check if this message has replies
		const hasReplies = message.replyCount && message.replyCount > 0;

		if (hasReplies && forEveryone) {
			toast.warning(`This message has ${message.replyCount} ${message.replyCount === 1 ? 'reply' : 'replies'}. Deleting will mark them as unavailable.`);
		}

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
			toast.success(deleteForEveryone ? "Message deleted for everyone" : "Message deleted for you");

			// Clear reply if deleting the message being replied to
			if (replyingTo && (replyingTo._id === messageId || replyingTo.id === messageId)) {
				handleClearReply();
			}
		} catch (error) {
			console.error("Delete error:", error);
			toast.error(error.message || "Failed to delete message");
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
			toast.success(`Forwarded to ${selectedContacts.length} contact(s)`);
		} catch (error) {
			console.error("Forward error:", error);
			toast.error(error.message || "Failed to forward message");
		}
	};

	// Handle copy
	const handleCopy = useCallback((message) => {
		const content = message.content || message.text || '';
		if (content) {
			navigator.clipboard.writeText(content);
			toast.success("Message copied");
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
			toast.error(error.message || "Failed to react");
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
			toast.error(error.message || "Failed to retry message");
		}
	}, [retryFailedMessage]);

	// Handle info
	const handleInfo = useCallback((message) => {
		setMessageInfo(message);
		// Set the anchor element for the popover
		const element = messageRefs.current[message._id || message.id];
		if (element) {
			setMessageAnchor(element);
		}
	}, []);

	// Long press handling for mobile
	const handleLongPress = useCallback((message) => {
		if (isMobile) {
			setLongPressedMessage(message);
		}
	}, [isMobile]);

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

							{isLoadingMore && !showLoadMoreButton && (
								<div className="flex justify-center py-2">
									<Loader2 className="h-5 w-5 animate-spin text-gray-400" />
								</div>
							)}

							{/* Loading indicator when searching for a message */}
							{isSearchingMessage && (
								<div className="flex justify-center py-2">
									<div className="bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-full flex items-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin text-blue-500" />
										<span className="text-sm text-blue-600 dark:text-blue-400">Searching for message...</span>
									</div>
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

								// Check if this message is being edited
								const isBeingEdited = editingMessage?._id === message._id || editingMessage?.id === message.id;

								// Check if this message is highlighted
								const isHighlighted = highlightedMessageId === (message._id || message.id);

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

										<div
											className={isGrouped ? 'mt-1' : 'mt-2'}
											ref={(el) => {
												if (el) {
													messageRefs.current[message._id || message.id] = el;
												}
											}}
										>
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
												onLongPress={handleLongPress}
												isMobile={isMobile}
												isBeingEdited={isBeingEdited}
												isHighlighted={isHighlighted}
												onScrollToReply={scrollToMessage}
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

			{/* Message Actions Component */}
			<MessageActions
				deletingMessage={deletingMessage}
				deleteForEveryone={deleteForEveryone}
				onConfirmDelete={confirmDelete}
				onCancelDelete={() => setDeletingMessage(null)}
				forwardingMessage={forwardingMessage}
				selectedContacts={selectedContacts}
				dmContacts={dmContacts}
				onContactToggle={(contact) => {
					setSelectedContacts(prev =>
						prev.find(c => c._id === contact._id)
							? prev.filter(c => c._id !== contact._id)
							: [...prev, contact]
					);
				}}
				onForwardSend={handleForwardSend}
				onCancelForward={() => setForwardingMessage(null)}
				messageInfo={messageInfo}
				messageAnchor={messageAnchor}
				onCloseInfo={() => {
					setMessageInfo(null);
					setMessageAnchor(null);
				}}
				longPressedMessage={longPressedMessage}
				onCloseLongPress={() => setLongPressedMessage(null)}
				onLongPressAction={(action, message) => {
					setLongPressedMessage(null);
					switch (action) {
						case 'reply':
							handleReply(message);
							break;
						case 'edit':
							handleEdit(message);
							break;
						case 'copy':
							handleCopy(message);
							break;
						case 'forward':
							handleForward(message);
							break;
						case 'delete':
							handleDelete(message, false);
							break;
						case 'deleteForEveryone':
							handleDelete(message, true);
							break;
						case 'info':
							handleInfo(message);
							break;
					}
				}}
				currentUser={currentUser}
			/>
		</>
	);
}

export default memo(ChatMessagesPanel);