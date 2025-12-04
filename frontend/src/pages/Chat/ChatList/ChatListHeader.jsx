import { useState, useRef } from 'react';
import { Search, Edit, ListFilter, MoreHorizontal, ArrowLeft, X, Archive, Check, Menu as MenuIcon } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import NewChatModal from './NewChatModal';
import MobileNavSheet from '@/components/MobileNavSheet';
import SettingsModal from '@/pages/Settings/SettingsModal';
import { useIsMobile } from '@/hooks/use-mobile';

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
	const [navSheetOpen, setNavSheetOpen] = useState(false);
	const [settingsTab, setSettingsTab] = useState('general');
	const [showSettingsModal, setShowSettingsModal] = useState(false);
	const isMobile = useIsMobile();

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

	const renderDesktopHeader = () => (
		<>
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
			{showFilters && renderFilterChips()}
		</>
	);

	const renderMobileHeader = () => (
		<>
			<div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-gray-900 sticky top-0 z-20">
				<div className="flex items-center gap-2">
					<button
						onClick={() => setNavSheetOpen(true)}
						className="p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						aria-label="Open navigation"
					>
						<MenuIcon className="h-5 w-5" />
					</button>
					<h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chats</h2>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => setShowFilters((prev) => !prev)}
						className={`p-2 rounded-full transition-colors ${showFilters ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
						aria-label="Filter chats"
					>
						<ListFilter className="h-5 w-5" />
					</button>
					<button
						onClick={() => setIsSelectionMode(true)}
						className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						aria-label="Select chats"
					>
						<MoreHorizontal className="h-5 w-5" />
					</button>
					<button
						onClick={() => setIsNewChatModalOpen(true)}
						className="p-2 rounded-full text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						aria-label="New chat"
					>
						<Edit className="h-5 w-5" />
					</button>
				</div>
			</div>

			<div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
				<div className="relative">
					<input
						ref={searchInputRef}
						type="text"
						placeholder="Search"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full pl-11 pr-12 py-2.5 rounded-full bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500"
					/>
					<Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
					{searchQuery ? (
						<button
							onClick={() => setSearchQuery('')}
							className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					) : (
						<button
							onClick={() => setShowFilters(!showFilters)}
							className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500"
						>
							<ListFilter className="h-4 w-4" />
						</button>
					)}
				</div>
			</div>

			{showFilters && (
				<div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
					{renderFilterChips()}
				</div>
			)}

			{/* Mobile nav sheet */}
			<MobileNavSheet
				open={navSheetOpen}
				onOpenChange={setNavSheetOpen}
				onOpenSettings={(tab) => {
					setSettingsTab(tab);
					setShowSettingsModal(true);
				}}
			/>

			{/* Mobile New Chat Modal */}
			{isMobile && isNewChatModalOpen && (
				<div
					className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4"
					onClick={() => setIsNewChatModalOpen(false)}
				>
					<div
						className="w-full max-w-md"
						onClick={(e) => e.stopPropagation()}
					>
						<NewChatModal
							isOpen={isNewChatModalOpen}
							onClose={() => setIsNewChatModalOpen(false)}
							isMobile
						/>
					</div>
				</div>
			)}

			<SettingsModal
				isOpen={showSettingsModal}
				onClose={() => setShowSettingsModal(false)}
				tab={settingsTab}
			/>
		</>
	);

	return isMobile ? renderMobileHeader() : renderDesktopHeader();
};

export default ChatListHeader;