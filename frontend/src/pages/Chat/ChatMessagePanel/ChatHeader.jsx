import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreVertical, Phone, Video, Search as SearchIcon, ArrowLeft } from 'lucide-react';
import Avatar from '@/components/Avatar';
import GroupInfoPopover from '@/components/GroupInfoPopover';
import { useConversationStore } from '@/store/conversationStore';
import { useAuthStore } from '@/store/authStore';
import { useContactsStore } from '@/store/contactsStore';
import { useChatStore } from '@/store/chatStore';

const ChatHeader = ({
	selectedChat,
	chatName,
	chatAvatar,
	isUserOnline,
	isGroupChat,
	isTyping,
	isMobile,
}) => {
	const avatarBtnRef = useRef(null);
	const menuBtnRef = useRef(null);
	const [showGroupInfo, setShowGroupInfo] = useState(false);
	const navigate = useNavigate();
	const { setSelectedChat, showMobileChatList } = useChatStore();
	const handleMobileBack = () => {
		showMobileChatList?.();
		setSelectedChat(null);
		navigate('/chat', { replace: true });
	};


	const { user: currentUser } = useAuthStore();
	const { allUsers, fetchAllUsers } = useContactsStore();

	const {
		updateConversationInfo,
		addMember,
		removeMember,
		leaveConversation,
		muteConversation,
		unmuteConversation,
		getContactByConversationId,
		approveJoinRequest,
		rejectJoinRequest,
	} = useConversationStore();

	// Resolve the freshest conversation object from the store when an ID is present
	const conversation = useMemo(() => {
		if (!selectedChat) return null;
		if (selectedChat?.conversationId) {
			return getContactByConversationId(selectedChat.conversationId) || selectedChat;
		}
		return selectedChat;
	}, [selectedChat, getContactByConversationId]);

	// Prefetch contacts only when popover is opened and list is empty
	useEffect(() => {
		if (showGroupInfo && (!allUsers || allUsers.length === 0)) {
			fetchAllUsers?.().catch(() => { });
		}
	}, [showGroupInfo, allUsers?.length, fetchAllUsers]);

	// Last seen logic
	const [showLastSeen, setShowLastSeen] = useState(true);
	useEffect(() => {
		if (!isUserOnline && conversation?.lastActivity) {
			setShowLastSeen(true);
			const t = setTimeout(() => setShowLastSeen(false), 5000);
			return () => clearTimeout(t);
		}
	}, [isUserOnline, conversation?.lastActivity]);

	const getLastSeenText = () => {
		if (isTyping) return 'typing...';
		if (isUserOnline) return 'online';
		if (!showLastSeen) return '';
		const ts = conversation?.lastActivity;
		if (ts) {
			const d = new Date(ts);
			if (!Number.isNaN(d.getTime())) {
				const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
				if (diffMins < 1) return 'last seen just now';
				if (diffMins < 60) return `last seen ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
				const diffHours = Math.floor(diffMins / 60);
				if (diffHours < 24) return `last seen ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
				const diffDays = Math.floor(diffHours / 24);
				if (diffDays < 7) return `last seen ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
				return `last seen ${d.toLocaleDateString()}`;
			}
		}
		return '';
	};

	const handleOpenGroupInfo = () => setShowGroupInfo(v => !v);

	const handleAvatarClick = () => {
		// For desktop, open only for groups; for mobile open for both
		if (!isGroupChat && !isMobile) return;
		handleOpenGroupInfo();
	};

	const handleMenuClick = () => handleOpenGroupInfo();

	const safeConversationId = conversation?.conversationId || conversation?.id;

	const handleUpdateGroup = async (updates) => {
		if (!safeConversationId) return;
		try {
			// Pass through plain object OR FormData as provided by GroupInfoPopover
			await updateConversationInfo(safeConversationId, updates);
		} catch (e) {
			console.error('Failed to update group:', e);
			alert(e?.message || 'Failed to update group');
		}
	};

	const handleAddMembers = async (memberIds) => {
		if (!safeConversationId || !memberIds?.length) return;
		try {
			let requestCount = 0;
			let addCount = 0;
			// sequential to keep store state in-sync deterministically
			for (const id of memberIds) {
				// guard against self / duplicates
				if (!id || id === currentUser?._id) continue;
				try {
					const response = await addMember(safeConversationId, id);
					// Check if it was a request (backend returns isRequest: true)
					// The backend now handles the logic, so we just check the response
					if (response?.isRequest) {
						requestCount++;
					} else {
						addCount++;
					}
				} catch (e) {
					console.error(`Failed to add member ${id}:`, e);
				}
			}
			// Show feedback
			if (requestCount > 0 && addCount > 0) {
				alert(`${addCount} member(s) added. ${requestCount} request(s) sent to admins for approval.`);
			} else if (requestCount > 0) {
				alert(`${requestCount} request(s) sent to admins for approval.`);
			} else if (addCount > 0) {
				// Success - no need to alert for direct adds
			}
		} catch (e) {
			console.error('Failed to add members:', e);
			alert(e?.message || 'Failed to add members');
		}
	};

	const handleApproveJoinRequest = async (userId) => {
		if (!safeConversationId || !userId) return;
		try {
			await approveJoinRequest(safeConversationId, userId);
		} catch (e) {
			console.error('Failed to approve join request:', e);
			alert(e?.message || 'Failed to approve join request');
		}
	};

	const handleRejectJoinRequest = async (userId) => {
		if (!safeConversationId || !userId) return;
		if (!window.confirm('Reject this join request?')) return;
		try {
			await rejectJoinRequest(safeConversationId, userId);
		} catch (e) {
			console.error('Failed to reject join request:', e);
			alert(e?.message || 'Failed to reject join request');
		}
	};

	const handleRemoveMember = async (memberId) => {
		if (!safeConversationId || !memberId) return;
		if (!window.confirm('Remove this member from the group?')) return;
		try {
			await removeMember(safeConversationId, memberId);
		} catch (e) {
			console.error('Failed to remove member:', e);
			alert(e?.message || 'Failed to remove member');
		}
	};

	const handleLeaveGroup = async () => {
		if (!safeConversationId) return;
		if (!window.confirm('Are you sure you want to exit this group?')) return;
		try {
			await leaveConversation(safeConversationId);
			setShowGroupInfo(false);
		} catch (e) {
			console.error('Failed to leave group:', e);
			alert(e?.message || 'Failed to leave group');
		}
	};

	const handleMuteConversation = async () => {
		if (!safeConversationId) return;
		try {
			await muteConversation(safeConversationId, 24);
		} catch (e) {
			console.error('Failed to mute:', e);
		}
	};

	const handleUnmuteConversation = async () => {
		if (!safeConversationId) return;
		try {
			await unmuteConversation(safeConversationId);
		} catch (e) {
			console.error('Failed to unmute:', e);
		}
	};

	const headerName = chatName ?? conversation?.name ?? 'Chat';
	const headerAvatar = chatAvatar ?? conversation?.avatar ?? null;
	const memberCount =
		conversation?.memberCount ??
		conversation?.participants?.length ??
		0;

	return (
		<>
			<div className={`px-3 py-2 sm:px-4 sm:py-2.5 flex items-center bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${isMobile ? 'sticky top-0 z-20' : ''}`}>
				<div className="flex items-center flex-1 min-w-0">
					{isMobile && (
						<button
							onClick={handleMobileBack}
							className="p-2 -ml-2 mr-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
							aria-label="Back to chats"
						>
							<ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-200" />
						</button>
					)}
					<button
						ref={avatarBtnRef}
						onClick={handleAvatarClick}
						className="mr-2.5 sm:mr-3 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-full"
						aria-label={isGroupChat ? 'Group info' : 'Profile'}
					>
						<Avatar
							src={headerAvatar}
							name={headerName}
							id={safeConversationId || headerName}
							size={isMobile ? 'sm' : 'md'}
							showOnline={conversation?.type === 'direct'}
							isOnline={!!isUserOnline}
						/>
					</button>

					<button
						onClick={handleAvatarClick}
						className="flex-1 min-w-0 text-left focus:outline-none"
						aria-label="Open chat details"
					>
						<h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
							{headerName}
						</h3>
						{(getLastSeenText() || isGroupChat) && (
							<p
								className={`text-xs sm:text-sm truncate mt-0.5 ${isUserOnline && !isTyping
									? 'text-green-600 dark:text-green-400 font-medium'
									: isTyping
										? 'text-blue-600 dark:text-blue-400 font-medium'
										: 'text-gray-500 dark:text-gray-400'
									}`}
							>
								{isGroupChat ? `${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : getLastSeenText()}
							</p>
						)}
					</button>
				</div>

				<div className="flex items-center space-x-0.5 sm:space-x-1 ml-2">
					{!isMobile && (
						<>
							<button
								className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
								title="Search in chat"
								aria-label="Search in chat"
							>
								<SearchIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
							</button>
							{conversation?.type === 'direct' && (
								<>
									<button
										className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
										title="Voice call"
										aria-label="Voice call"
									>
										<Phone className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
									</button>
									<button
										className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
										title="Video call"
										aria-label="Video call"
									>
										<Video className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
									</button>
								</>
							)}
						</>
					)}
					<button
						ref={menuBtnRef}
						onClick={handleMenuClick}
						className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
						title="More options"
						aria-label="Open menu"
					>
						<MoreVertical className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
					</button>
				</div>
			</div>

			{showGroupInfo && conversation && (
				<GroupInfoPopover
					isOpen={showGroupInfo}
					onClose={() => setShowGroupInfo(false)}
					anchorRef={avatarBtnRef}
					conversation={conversation}
					currentUser={currentUser}
					onUpdateGroup={handleUpdateGroup}
					onAddMembers={handleAddMembers}
					onRemoveMember={handleRemoveMember}
					onLeaveGroup={handleLeaveGroup}
					onMuteConversation={handleMuteConversation}
					onUnmuteConversation={handleUnmuteConversation}
					onApproveJoinRequest={handleApproveJoinRequest}
					onRejectJoinRequest={handleRejectJoinRequest}
					allUsers={allUsers}
					isMobile={isMobile}
				/>
			)}
		</>
	);
};

export default ChatHeader;