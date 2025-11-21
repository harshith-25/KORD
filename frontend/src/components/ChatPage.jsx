import { useEffect, useState } from 'react';
import { useChatStore } from './store/chatStore';
import { useAuthStore } from './store/authStore';
import ChatList from './components/ChatList';
import MessageInput from './components/MessageInput';
import NewChatModal from './components/NewChatModal';
import { Loader2, Plus, LogOut, Settings, User, MessageCircle, XCircle } from 'lucide-react'; // Ensure XCircle is imported

const ChatPage = ({ onSettingsOpen }) => {
	const {
		contacts,
		selectedChatId,
		loadingContacts,
		error: chatError,
		fetchContacts,
		setSelectedChat,
		initializeSocket,
		socketConnected,
		clearChatState
	} = useChatStore();

	const { user, logout, loading: authLoading, error: authError } = useAuthStore();

	const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);

	// Initialize socket and fetch contacts on component mount/user change
	useEffect(() => {
		if (user && user._id) {
			// Initialize socket first
			const currentSocket = initializeSocket();
			if (currentSocket) {
				// Fetch contacts after socket is potentially connected
				fetchContacts();
			}
			if (authLoading) {
				return (
					<div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300">
						<Loader2 className="w-10 h-10 animate-spin mr-3" /> Loading user session...
					</div>
				);
			}

			if (authError) {
				return (
					<div className="flex items-center justify-center h-screen bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 text-center">
						<XCircle className="w-8 h-8 mr-3" /> Authentication Error: {authError}
						<button onClick={logout} className="ml-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600">
							Re-login
						</button>
					</div>
				);
			}

			if (!user || !user._id) {
				// If user is not authenticated after initial loading, redirect to login (or show login UI)
				// In a real app, you'd use React Router or similar here to navigate to login.
				return (
					<div className="flex items-center justify-center h-screen bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
						<p>Please log in to access your chats.</p>
						{/* You might add a link/button to login page here */}
					</div>
				);
			}

			const selectedChat = contacts.find(chat => chat.id === selectedChatId);

			return (
				<div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter">
					{/* Left Sidebar (Chat List & Profile/Settings) */}
					<div className="flex flex-col w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 shadow-md">
						{/* User Profile & Actions Header */}
						<div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-purple-600 text-white rounded-tr-lg">
							<div className="flex items-center">
								{user?.image ? (
									<img
										src={user.image}
										alt="User Avatar"
										className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-300"
									/>
								) : (
									<div className="w-10 h-10 rounded-full bg-purple-400 flex items-center justify-center text-xl font-bold">
										<User size={24} />
									</div>
								)}
								<span className="ml-3 font-semibold text-lg">{user.firstName} {user.lastName}</span>
							</div>
							<div className="flex space-x-2">
								<button
									onClick={() => setIsNewChatModalOpen(true)}
									className="p-2 rounded-full hover:bg-purple-700 transition-colors"
									title="Start New Chat"
								>
									<Plus size={24} />
								</button>
								<button
									onClick={onSettingsOpen} // This prop should open the SettingsPage modal
									className="p-2 rounded-full hover:bg-purple-700 transition-colors"
									title="Settings"
								>
									<Settings size={24} />
								</button>
								<button
									onClick={handleLogout}
									className="p-2 rounded-full hover:bg-red-700 transition-colors"
									title="Logout"
								>
									<LogOut size={24} />
								</button>
							</div>
						</div>

						{/* Chat List */}
						<div className="flex-1 overflow-y-auto p-2">
							{loadingContacts ? (
								<div className="flex justify-center items-center h-full">
									<Loader2 className="w-6 h-6 animate-spin text-gray-500" />
								</div>
							) : chatError ? (
								<div className="text-red-500 text-center p-4">Error loading chats: {chatError}</div>
							) : contacts.length === 0 ? (
								<div className="text-gray-500 dark:text-gray-400 text-center p-4">
									No chats yet. Click '+' to start one!
								</div>
							) : (
								<ChatList contacts={contacts} selectedChatId={selectedChatId} onSelectChat={setSelectedChat} />
							)}
						</div>
					</div>

					{/* Right Content Area (Chat Window & Message Input) */}
					<div className="flex flex-col flex-1 bg-gray-50 dark:bg-gray-900 rounded-bl-lg">
						{selectedChatId ? (
							<>
								{/* Chat Header */}
								<div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex items-center shadow-sm">
									{selectedChat?.avatar ? (
										<img
											src={selectedChat.avatar}
											alt="Chat Avatar"
											className="w-10 h-10 rounded-full object-cover mr-3"
										/>
									) : (
										<div className="w-10 h-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center mr-3 text-lg font-bold">
											{selectedChat?.name ? selectedChat.name.charAt(0).toUpperCase() : <User size={20} />}
										</div>
									)}
									<span className="font-semibold text-lg">{selectedChat?.name || 'Loading Chat...'}</span>
									{/* Add online status if available in selectedChat */}
									{/* <span className="ml-2 text-sm text-green-500">Online</span> */}
								</div>

								{/* Message Input */}
								<MessageInput conversationId={selectedChatId} />
							</>
						) : (
							<div className="flex items-center justify-center flex-1 text-gray-500 dark:text-gray-400 text-center p-4">
								<MessageCircle className="w-16 h-16 mb-4" />
								<p className="text-xl">Select a chat to start messaging.</p>
							</div>
						)}
					</div>

					{/* New Chat Modal */}
					<NewChatModal isOpen={isNewChatModalOpen} onClose={() => setIsNewChatModalOpen(false)} />
				</div>
			);
		};

		export default ChatPage;