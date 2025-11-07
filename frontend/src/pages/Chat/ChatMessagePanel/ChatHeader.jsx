// components/ChatHeader.jsx
import React, { useEffect, useRef, useState } from 'react';
import { MoreVertical, Phone, Video, Search as SearchIcon } from 'lucide-react';
import Avatar from '@/components/Avatar';
import GroupInfoPopover from '@/components/GroupInfoPopover';
import { useConversationStore } from '@/store/conversationStore';
import { useAuthStore } from '@/store/authStore';
import { useContactsStore } from '@/store/contactsStore';

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
	} = useConversationStore();

	useEffect(() => {
		if (showGroupInfo && allUsers.length === 0) fetchAllUsers();
	}, [showGroupInfo, allUsers.length, fetchAllUsers]);

	const conversation = selectedChat?.conversationId
		? getContactByConversationId(selectedChat.conversationId)
		: selectedChat;

	// Last seen logic
	const [showLastSeen, setShowLastSeen] = useState(true);
	useEffect(() => {
		if (!isUserOnline && selectedChat?.lastActivity) {
			setShowLastSeen(true);
			const t = setTimeout(() => setShowLastSeen(false), 5000);
			return () => clearTimeout(t);
		}
	}, [isUserOnline, selectedChat?.lastActivity]);

	const getLastSeenText = () => {
		if (isTyping) return 'typing...';
		if (isUserOnline) return 'online';
		if (!showLastSeen) return '';
		if (selectedChat?.lastActivity) {
			try {
				const d = new Date(selectedChat.lastActivity);
				if (!isNaN(d.getTime())) {
					const now = new Date();
					const diffMins = Math.floor((now - d) / 60000);
					if (diffMins < 1) return 'last seen just now';
					if (diffMins < 60) return `last seen ${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
					const diffHours = Math.floor(diffMins / 60);
					if (diffHours < 24) return `last seen ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
					const diffDays = Math.floor(diffHours / 24);
					if (diffDays < 7) return `last seen ${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
					return `last seen ${d.toLocaleDateString()}`;
				}
			} catch (e) {
				console.error(e);
			}
		}
		return '';
	};

	const handleOpenGroupInfo = () => {
		setShowGroupInfo(v => !v);
	};

	const handleAvatarClick = () => {
		if (!isGroupChat && !isMobile) return; // Only open for groups on desktop
		handleOpenGroupInfo();
	};

	const handleMenuClick = () => {
		handleOpenGroupInfo();
	};

	const handleUpdateGroup = async (updates) => {
		if (!selectedChat?.conversationId) return;
		try {
			await updateConversationInfo(selectedChat.conversationId, updates);
		} catch (e) {
			console.error('Failed to update group:', e);
			alert(e.message || 'Failed to update group');
		}
	};

	const handleAddMembers = async (memberIds) => {
		if (!selectedChat?.conversationId || !memberIds.length) return;
		try {
			for (const id of memberIds) {
				await addMember(selectedChat.conversationId, id);
			}
		} catch (e) {
			console.error('Failed to add members:', e);
			alert(e.message || 'Failed to add members');
		}
	};

	const handleRemoveMember = async (memberId) => {
		if (!selectedChat?.conversationId) return;
		if (!window.confirm('Remove this member from the group?')) return;
		try {
			await removeMember(selectedChat.conversationId, memberId);
		} catch (e) {
			console.error('Failed to remove member:', e);
			alert(e.message || 'Failed to remove member');
		}
	};

	const handleLeaveGroup = async () => {
		if (!selectedChat?.conversationId) return;
		if (!window.confirm('Are you sure you want to exit this group?')) return;
		try {
			await leaveConversation(selectedChat.conversationId);
			setShowGroupInfo(false);
		} catch (e) {
			console.error('Failed to leave group:', e);
			alert(e.message || 'Failed to leave group');
		}
	};

	const handleMuteConversation = async () => {
		if (!selectedChat?.conversationId) return;
		try {
			await muteConversation(selectedChat.conversationId, 24);
		} catch (e) {
			console.error('Failed to mute:', e);
		}
	};

	const handleUnmuteConversation = async () => {
		if (!selectedChat?.conversationId) return;
		try {
			await unmuteConversation(selectedChat.conversationId);
		} catch (e) {
			console.error('Failed to unmute:', e);
		}
	};

	return (
		<>
			<div className="px-3 py-2 sm:px-4 sm:py-2.5 flex items-center bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
				<div className="flex items-center flex-1 min-w-0">
					<button
						ref={avatarBtnRef}
						onClick={handleAvatarClick}
						className="mr-2.5 sm:mr-3 focus:outline-none focus:ring-2 focus:ring-green-500 rounded-full"
						aria-label={isGroupChat ? "Group info" : "Profile"}
					>
						<Avatar
							src={chatAvatar}
							name={chatName}
							id={selectedChat?.conversationId || selectedChat?.id || chatName}
							size={isMobile ? 'sm' : 'md'}
							showOnline={selectedChat?.type === 'direct'}
							isOnline={isUserOnline}
						/>
					</button>

					<button
						onClick={handleAvatarClick}
						className="flex-1 min-w-0 text-left focus:outline-none"
					>
						<h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
							{chatName}
						</h3>
						{(getLastSeenText() || isGroupChat) && (
							<p className={`text-xs sm:text-sm truncate mt-0.5 ${isUserOnline && !isTyping
								? 'text-green-600 dark:text-green-400 font-medium'
								: isTyping
									? 'text-blue-600 dark:text-blue-400 font-medium'
									: 'text-gray-500 dark:text-gray-400'
								}`}>
								{isGroupChat
									? `${selectedChat?.memberCount || selectedChat?.participants?.length || '0'} members`
									: getLastSeenText()
								}
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
							>
								<SearchIcon className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
							</button>
							{selectedChat?.type === 'direct' && (
								<>
									<button
										className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
										title="Voice call"
									>
										<Phone className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-300" />
									</button>
									<button
										className="p-1.5 sm:p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
										title="Video call"
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
					allUsers={allUsers}
					isMobile={isMobile}
				/>
			)}
		</>
	);
};

export default ChatHeader;