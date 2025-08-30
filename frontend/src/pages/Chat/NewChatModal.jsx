import React, { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useContactsStore } from '@/store/contactsStore';
import { Search, MessageCircle, Users, UserPlus, User, Loader2 } from 'lucide-react';

const NewChatModal = ({ isOpen, onClose, anchorRef }) => {
	const [searchTerm, setSearchTerm] = useState('');
	const [loadingSearch, setLoadingSearch] = useState(false);
	const [startingChat, setStartingChat] = useState(null);
	const [showAnimation, setShowAnimation] = useState(false);
	const modalRef = useRef(null);
	const searchInputRef = useRef(null);

	const { startNewIndividualChat, setSelectedChat } = useChatStore();
	const { user: currentUser } = useAuthStore();
	const { searchUsers, searchResults, setSearchResults } = useContactsStore();

	// Handle opening animation
	useEffect(() => {
		if (isOpen) {
			setShowAnimation(true);
			// Focus search input after animation
			setTimeout(() => {
				searchInputRef.current?.focus();
			}, 150);
		} else {
			setShowAnimation(false);
			setSearchTerm('');
			setSearchResults([]);
			setLoadingSearch(false);
			setStartingChat(null);
		}
	}, [isOpen, setSearchResults]);

	// Click outside to close
	useEffect(() => {
		const handleClickOutside = (event) => {
			if (modalRef.current && !modalRef.current.contains(event.target) &&
				anchorRef?.current && !anchorRef.current.contains(event.target)) {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => document.removeEventListener('mousedown', handleClickOutside);
		}
	}, [isOpen, onClose, anchorRef]);

	// Debounced search
	useEffect(() => {
		const delayDebounceFn = setTimeout(async () => {
			if (searchTerm.trim().length > 0) {
				setLoadingSearch(true);
				await searchUsers(searchTerm.trim());
				setLoadingSearch(false);
			} else {
				setSearchResults([]);
			}
		}, 300);

		return () => clearTimeout(delayDebounceFn);
	}, [searchTerm, searchUsers, setSearchResults]);

	const handleSelectUser = async (user) => {
		if (startingChat === user._id) return;
		setStartingChat(user._id);

		try {
			const userForChat = {
				_id: user._id,
				firstName: user.firstName,
				lastName: user.lastName,
				email: user.email,
				profilePicture: user.image,
			};
			const newChatId = await startNewIndividualChat(userForChat);
			if (newChatId) {
				setSelectedChat(newChatId);
				onClose();
			}
		} catch (error) {
			console.error("Error starting new chat:", error);
		} finally {
			setStartingChat(null);
		}
	};

	const handleNewGroup = () => {
		// TODO: Implement new group functionality
		console.log('New Group clicked');
		onClose();
	};

	const handleNewContact = () => {
		// TODO: Implement new contact functionality
		console.log('New Contact clicked');
		onClose();
	};

	const handleMessageYourself = () => {
		// TODO: Implement message yourself functionality
		console.log('Message Yourself clicked');
		onClose();
	};

	const getAvatarUrl = (user) => {
		if (user.image) return user.image;
		const initials = `${user.firstName || ''} ${user.lastName || ''}`.trim();
		return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(initials)}&backgroundColor=random&radius=50`;
	};

	const getUserDisplayName = (user) => {
		const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
		return fullName || user.email || 'Unknown User';
	};

	if (!isOpen) return null;

	return (
		<div
			ref={modalRef}
			className={`fixed z-50 w-80 transition-all duration-200 ease-out ${showAnimation ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'
				}`}
			style={{
				top: anchorRef?.current ?
					anchorRef.current.getBoundingClientRect().bottom + 8 + 'px' :
					'60px',
				// Change this line - use left instead of right
				left: anchorRef?.current ?
					anchorRef.current.getBoundingClientRect().right + 8 + 'px' :
					'20px'
			}}
		>
			{/* Glass morphism container */}
			<div className="backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border border-white/20 dark:border-gray-700/30 rounded-lg shadow-2xl overflow-hidden">
				{/* Search Section */}
				<div className="p-4 border-b border-white/10 dark:border-gray-700/30">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={16} />
						<input
							ref={searchInputRef}
							type="text"
							placeholder="Search name or number"
							className="w-full pl-9 pr-3 py-2 text-sm bg-gray-100/60 dark:bg-gray-800/60 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:bg-white/80 dark:focus:bg-gray-700/80 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all backdrop-blur-sm"
							value={searchTerm}
							onChange={(e) => setSearchTerm(e.target.value)}
							disabled={startingChat}
						/>
					</div>
				</div>

				{/* Quick Actions */}
				<div className="border-b border-white/10 dark:border-gray-700/30">
					<button
						onClick={handleNewGroup}
						className="w-full flex items-center px-4 py-3 hover:bg-white/40 dark:hover:bg-gray-700/40 transition-colors group"
						disabled={startingChat}
					>
						<div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mr-3 group-hover:bg-green-600 transition-colors">
							<Users size={18} className="text-white" />
						</div>
						<span className="text-gray-900 dark:text-white font-medium">New group</span>
					</button>

					<button
						onClick={handleNewContact}
						className="w-full flex items-center px-4 py-3 hover:bg-white/40 dark:hover:bg-gray-700/40 transition-colors group"
						disabled={startingChat}
					>
						<div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mr-3 group-hover:bg-green-600 transition-colors">
							<UserPlus size={18} className="text-white" />
						</div>
						<span className="text-gray-900 dark:text-white font-medium">New contact</span>
					</button>

					{currentUser && (
						<button
							onClick={handleMessageYourself}
							className="w-full flex items-center px-4 py-3 hover:bg-white/40 dark:hover:bg-gray-700/40 transition-colors group border-b border-white/10 dark:border-gray-700/30"
							disabled={startingChat}
						>
							<div className="relative w-10 h-10 mr-3">
								{currentUser.profilePicture ? (
									<img
										src={currentUser.profilePicture}
										alt={currentUser.firstName || 'You'}
										className="w-10 h-10 rounded-full object-cover"
									/>
								) : (
									<div className="w-10 h-10 rounded-full bg-gray-400 flex items-center justify-center">
										<User size={18} className="text-white" />
									</div>
								)}
							</div>
							<div className="text-left">
								<div className="text-gray-900 dark:text-white font-medium">
									{getUserDisplayName(currentUser)} (You)
								</div>
								<div className="text-xs text-gray-500 dark:text-gray-400">
									Message yourself
								</div>
							</div>
						</button>
					)}
				</div>

				{/* Search Results or Contacts */}
				<div className="max-h-80 overflow-y-auto">
					{loadingSearch && (
						<div className="flex items-center justify-center py-8">
							<Loader2 className="animate-spin text-green-500 mr-2" size={16} />
							<span className="text-sm text-gray-600 dark:text-gray-400">Searching...</span>
						</div>
					)}

					{!loadingSearch && searchTerm && searchResults.length === 0 && (
						<div className="text-center py-8 px-4">
							<div className="text-gray-500 dark:text-gray-400">
								<Search size={32} className="mx-auto mb-3 opacity-50" />
								<p className="text-sm">No results found for "{searchTerm}"</p>
								<p className="text-xs mt-1 opacity-75">Try a different search term</p>
							</div>
						</div>
					)}

					{!loadingSearch && (!searchTerm || searchResults.length > 0) && (
						<div>
							{searchTerm && (
								<div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/30">
									CONTACTS
								</div>
							)}

							<div className="divide-y divide-white/10 dark:divide-gray-700/30">
								{(searchTerm ? searchResults : [])
									.filter(user => user._id !== currentUser?._id)
									.map((user) => (
										<button
											key={user._id}
											className={`w-full flex items-center p-4 transition-colors text-left ${startingChat === user._id
												? 'bg-gray-100/50 dark:bg-gray-700/50 cursor-not-allowed'
												: 'hover:bg-white/40 dark:hover:bg-gray-700/40'
												}`}
											onClick={() => handleSelectUser(user)}
											disabled={startingChat === user._id}
										>
											{/* Avatar */}
											<div className="relative flex-shrink-0 mr-3">
												{user.image ? (
													<img
														src={getAvatarUrl(user)}
														alt={getUserDisplayName(user)}
														className="w-10 h-10 rounded-full object-cover"
														onError={(e) => {
															e.target.src = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(getUserDisplayName(user))}&backgroundColor=random&radius=50`;
														}}
													/>
												) : (
													<div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white font-semibold">
														{getUserDisplayName(user).charAt(0).toUpperCase()}
													</div>
												)}

												{startingChat === user._id && (
													<div className="absolute inset-0 bg-black bg-opacity-30 rounded-full flex items-center justify-center">
														<Loader2 className="animate-spin text-white" size={14} />
													</div>
												)}
											</div>

											{/* User Info */}
											<div className="flex-1 min-w-0">
												<p className="text-gray-900 dark:text-white font-medium truncate text-sm">
													{getUserDisplayName(user)}
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400 truncate">
													{user.email}
												</p>
											</div>

											{/* Status indicator */}
											{startingChat === user._id && (
												<Loader2 className="animate-spin text-green-500 flex-shrink-0" size={14} />
											)}
										</button>
									))}
							</div>
						</div>
					)}

					{!searchTerm && (
						<div className="text-center py-8 px-4">
							<div className="text-gray-500 dark:text-gray-400">
								<Search size={32} className="mx-auto mb-3 opacity-50" />
								<p className="text-sm">Search for contacts to start chatting</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default NewChatModal;


// import React, { useState, useEffect } from 'react';
// import { useChatStore } from '@/store/chatStore';
// import { useAuthStore } from '@/store/authStore';
// import { useContactsStore } from '@/store/contactsStore';
// import { X, CircleUser, Search, MessageCircle, Loader2 } from 'lucide-react';

// const NewChatModal = ({ isOpen, onClose }) => {
// 	const [searchTerm, setSearchTerm] = useState('');
// 	const [loadingSearch, setLoadingSearch] = useState(false);
// 	const [startingChat, setStartingChat] = useState(null);

// 	const { startNewIndividualChat, setSelectedChat } = useChatStore();
// 	const { user: currentUser } = useAuthStore();
// 	const { searchUsers, searchResults, setSearchResults } = useContactsStore();

// 	useEffect(() => {
// 		if (!isOpen) {
// 			setSearchTerm('');
// 			setSearchResults([]);
// 			setLoadingSearch(false);
// 			setStartingChat(null);
// 		}
// 	}, [isOpen, setSearchResults]);

// 	// Debounced search
// 	useEffect(() => {
// 		const delayDebounceFn = setTimeout(async () => {
// 			if (searchTerm.trim().length > 2) {
// 				setLoadingSearch(true);
// 				await searchUsers(searchTerm.trim());
// 				setLoadingSearch(false);
// 			} else {
// 				setSearchResults([]);
// 			}
// 		}, 500);

// 		return () => clearTimeout(delayDebounceFn);
// 	}, [searchTerm, searchUsers, setSearchResults]);

// 	const handleSelectUser = async (user) => {
// 		if (startingChat === user._id) return;
// 		setStartingChat(user._id);

// 		try {
// 			const userForChat = {
// 				_id: user._id,
// 				firstName: user.firstName,
// 				lastName: user.lastName,
// 				email: user.email,
// 				profilePicture: user.image,
// 			};
// 			const newChatId = await startNewIndividualChat(userForChat);
// 			if (newChatId) {
// 				setSelectedChat(newChatId);
// 				onClose();
// 			}
// 		} catch (error) {
// 			console.error("Error starting new chat:", error);
// 		} finally {
// 			setStartingChat(null);
// 		}
// 	};

// 	const getAvatarUrl = (user) => {
// 		if (user.image) return user.image;
// 		const initials = `${user.firstName || ''} ${user.lastName || ''}`.trim();
// 		return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(initials)}&backgroundColor=random&radius=50`;
// 	};

// 	const getUserDisplayName = (user) => {
// 		const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
// 		return fullName || user.email || 'Unknown User';
// 	};

// 	if (!isOpen) return null;

// 	return (
// 		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
// 			<div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col relative">
// 				{/* Header */}
// 				<div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
// 					<h2 className="text-xl font-semibold text-gray-900 dark:text-white">
// 						Start New Chat
// 					</h2>
// 					<button
// 						onClick={onClose}
// 						className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
// 						disabled={startingChat}
// 					>
// 						<X size={24} />
// 					</button>
// 				</div>

// 				{/* Search Input */}
// 				<div className="p-6 border-b border-gray-200 dark:border-gray-700">
// 					<div className="relative">
// 						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
// 						<input
// 							type="text"
// 							placeholder="Search by name or email..."
// 							className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-colors"
// 							value={searchTerm}
// 							onChange={(e) => setSearchTerm(e.target.value)}
// 							disabled={loadingSearch || startingChat}
// 						/>
// 					</div>
// 				</div>

// 				{/* Results Area */}
// 				<div className="flex-1 overflow-hidden">
// 					<div className="p-6 h-full">
// 						{loadingSearch && (
// 							<div className="flex items-center justify-center py-8">
// 								<Loader2 className="animate-spin text-purple-500 mr-2" size={20} />
// 								<span className="text-gray-600 dark:text-gray-400">Searching...</span>
// 							</div>
// 						)}

// 						{!loadingSearch && searchResults.length === 0 && (
// 							<div className="text-center py-8">
// 								{searchTerm.trim().length === 0 ? (
// 									<div className="text-gray-500 dark:text-gray-400">
// 										<Search size={48} className="mx-auto mb-4 opacity-50" />
// 										<p>Enter at least 3 characters to search for users</p>
// 									</div>
// 								) : searchTerm.trim().length <= 2 ? (
// 									<div className="text-gray-500 dark:text-gray-400">
// 										<p>Enter at least 3 characters to search</p>
// 									</div>
// 								) : (
// 									<div className="text-gray-500 dark:text-gray-400">
// 										<Search size={48} className="mx-auto mb-4 opacity-50" />
// 										<p>No users found matching "{searchTerm.trim()}"</p>
// 										<p className="text-sm mt-2">Try a different search term</p>
// 									</div>
// 								)}
// 							</div>
// 						)}

// 						{!loadingSearch && searchResults.length > 0 && (
// 							<div className="space-y-2 max-h-80 overflow-y-auto">
// 								{searchResults
// 									.filter(user => user._id !== currentUser?._id)
// 									.map((user) => (
// 										<div
// 											key={user._id}
// 											className={`flex items-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${startingChat === user._id
// 												? 'bg-purple-100 dark:bg-purple-900/20 cursor-not-allowed'
// 												: 'hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-sm'
// 												}`}
// 											onClick={() => handleSelectUser(user)}
// 										>
// 											{/* Avatar */}
// 											<div className="relative flex-shrink-0 mr-3">
// 												{user.image ? (
// 													<img
// 														src={getAvatarUrl(user)}
// 														alt={getUserDisplayName(user)}
// 														className="w-12 h-12 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
// 														onError={(e) => {
// 															e.target.src = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(getUserDisplayName(user))}&backgroundColor=random&radius=50`;
// 														}}
// 													/>
// 												) : (
// 													<div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-semibold text-lg border-2 border-gray-200 dark:border-gray-600">
// 														{getUserDisplayName(user).charAt(0).toUpperCase()}
// 													</div>
// 												)}

// 												{startingChat === user._id && (
// 													<div className="absolute inset-0 bg-black bg-opacity-20 rounded-full flex items-center justify-center">
// 														<Loader2 className="animate-spin text-white" size={20} />
// 													</div>
// 												)}
// 											</div>

// 											{/* User Info */}
// 											<div className="flex-1 min-w-0">
// 												<p className="text-gray-900 dark:text-white font-medium truncate">
// 													{getUserDisplayName(user)}
// 												</p>
// 												<p className="text-sm text-gray-600 dark:text-gray-400 truncate">
// 													{user.email}
// 												</p>
// 											</div>

// 											{/* Chat Icon */}
// 											<div className="flex-shrink-0 ml-3">
// 												{startingChat === user._id ? (
// 													<Loader2 className="animate-spin text-purple-500" size={20} />
// 												) : (
// 													<MessageCircle className="text-gray-400 hover:text-purple-500 transition-colors" size={20} />
// 												)}
// 											</div>
// 										</div>
// 									))}
// 							</div>
// 						)}
// 					</div>
// 				</div>

// 				{/* Footer */}
// 				<div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
// 					<p className="text-xs text-gray-500 dark:text-gray-400 text-center">
// 						Search for users by name or email to start a conversation
// 					</p>
// 				</div>
// 			</div>
// 		</div>
// 	);
// };

// export default NewChatModal;