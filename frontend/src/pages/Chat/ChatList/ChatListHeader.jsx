import { useState, useRef } from 'react';
import { Search, Edit, ListFilter, MoreHorizontal, ArrowLeft, X, Archive, Check } from 'lucide-react';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NewChatModal from './NewChatModal';

const ChatListHeader = ({
	showBackButton,
	onBack,
	isSelectionMode,
	selectedChats,
	setIsSelectionMode,
	setSelectedChats,
	searchQuery,
	setSearchQuery,
	showFilters,
	setShowFilters,
	activeFilter,
	setActiveFilter,
	contacts,
}) => {
	const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
	const newChatButtonRef = useRef(null);
	const searchInputRef = useRef(null);

	const archiveChat = (chatId) => {
		console.log("Archive chat:", chatId);
	};

	const renderFilterChips = () => (
		<div className="px-3 pb-2 flex space-x-2 overflow-x-auto scrollbar-hide">
			{[
				{ key: 'all', label: 'All', count: contacts.filter(c => c.isActive && !c.isArchived).length },
				{ key: 'unread', label: 'Unread', count: contacts.filter(c => (c.unreadCount || 0) > 0).length },
				{ key: 'archived', label: 'Archived', count: contacts.filter(c => c.isArchived).length }
			].map(filter => (
				<button
					key={filter.key}
					onClick={() => setActiveFilter(filter.key)}
					className={`flex-shrink-0 px-3 py-1 rounded-full text-sm font-medium transition-all duration-300 backdrop-blur-md ${activeFilter === filter.key
						? 'bg-white/20 text-purple-600 shadow-lg border border-white/30'
						: 'bg-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/20 border border-white/10'
						}`}
				>
					{filter.label}
					{filter.count > 0 && (
						<span className={`ml-1 text-xs ${activeFilter === filter.key ? 'text-purple-500' : 'text-gray-500'
							}`}>
							{filter.count}
						</span>
					)}
				</button>
			))}
		</div>
	);

	return (
		<>
			{/* Header */}
			<div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0 bg-white/80 backdrop-blur-lg dark:bg-gray-800/80">
				<div className="flex items-center space-x-3">
					{showBackButton && (
						<button
							onClick={onBack}
							className="p-1 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
						>
							<ArrowLeft className="h-5 w-5 text-gray-600 dark:text-gray-300" />
						</button>
					)}
					<h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100">
						{isSelectionMode ? `${selectedChats.size} selected` : 'Chats'}
					</h2>
				</div>

				<div className="flex items-center space-x-2">
					{isSelectionMode ? (
						<>
							<button
								onClick={() => {
									selectedChats.forEach(chatId => archiveChat(chatId));
									setIsSelectionMode(false);
									setSelectedChats(new Set());
								}}
								className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
								title="Archive selected"
							>
								<Archive className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
							<button
								onClick={() => {
									setIsSelectionMode(false);
									setSelectedChats(new Set());
								}}
								className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
								title="Cancel selection"
							>
								<X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
						</>
					) : (
						<>
							<DropdownMenu open={isNewChatModalOpen} onOpenChange={setIsNewChatModalOpen}>
								<DropdownMenuTrigger asChild>
									<button
										ref={newChatButtonRef}
										className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
										title="New Chat"
									>
										<Edit className="h-5 w-5 text-gray-600 dark:text-gray-300" />
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="start"
									side="right"
									className="w-80 p-0 max-h-[calc(100vh-6rem)] overflow-hidden"
									sideOffset={8}
								>
									<NewChatModal
										isOpen={isNewChatModalOpen}
										onClose={() => setIsNewChatModalOpen(false)}
									/>
								</DropdownMenuContent>
							</DropdownMenu>

							<button
								onClick={() => setShowFilters(!showFilters)}
								className={`p-2 rounded-full transition-all duration-200 backdrop-blur-sm ${showFilters
									? 'bg-purple-100/60 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 shadow-md'
									: 'hover:bg-white/20 dark:hover:bg-gray-700/20 text-gray-600 dark:text-gray-300'
									}`}
								title="Filter Chats"
							>
								<ListFilter className="h-5 w-5" />
							</button>
							<button
								onClick={() => setIsSelectionMode(true)}
								className="p-2 rounded-full hover:bg-white/20 dark:hover:bg-gray-700/20 transition-all duration-200 backdrop-blur-sm"
								title="Select chats"
							>
								<MoreHorizontal className="h-5 w-5 text-gray-600 dark:text-gray-300" />
							</button>
						</>
					)}
				</div>
			</div>

			{/* Search Bar */}
			<div className="p-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
				<div className="relative">
					<input
						ref={searchInputRef}
						type="text"
						placeholder="Search conversations"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-10 pr-4 py-2 bg-white/30 dark:bg-gray-700/30 backdrop-blur-lg rounded-lg text-gray-800 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:bg-white/50 dark:focus:bg-gray-600/50 transition-all duration-200 border border-white/20 shadow-md"
					/>
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-gray-400" />
					{searchQuery && (
						<button
							onClick={() => setSearchQuery('')}
							className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-white/20 dark:hover:bg-gray-600/20 rounded-full transition-all duration-200 backdrop-blur-sm"
						>
							<X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
						</button>
					)}
				</div>
			</div>

			{/* Filter Chips */}
			{showFilters && renderFilterChips()}
		</>
	);
};

export default ChatListHeader;