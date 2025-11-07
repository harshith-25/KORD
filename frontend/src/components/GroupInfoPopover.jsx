// components/GroupInfoPopover.jsx
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
	X, Camera, ChevronRight, Search, UserPlus, Check, ArrowLeft,
	Users, Bell, BellOff, LogOut, Shield, Image, FileText, Link as LinkIcon,
	Calendar, Edit2
} from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

const NAV = [
	{ key: 'overview', label: 'Overview', Icon: ChevronRight },
	{ key: 'members', label: 'Members', Icon: Users },
	{ key: 'media', label: 'Media', Icon: Image },
	{ key: 'files', label: 'Files', Icon: FileText },
	{ key: 'links', label: 'Links', Icon: LinkIcon },
	{ key: 'events', label: 'Events', Icon: Calendar },
	{ key: 'encryption', label: 'Encryption', Icon: Shield },
];

const GroupInfoPopover = ({
	isOpen,
	onClose,
	anchorRef,
	conversation,
	currentUser,
	onUpdateGroup,
	onAddMembers,
	onRemoveMember,
	onLeaveGroup,
	onMuteConversation,
	onUnmuteConversation,
	allUsers = [],
	isMobile = false,
}) => {
	const popRef = useRef(null);
	const [pos, setPos] = useState({ top: 0, left: 0, side: 'right' });
	const [activeView, setActiveView] = useState('overview');
	const [searchTerm, setSearchTerm] = useState('');
	const [selectedMembers, setSelectedMembers] = useState([]);
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [description, setDescription] = useState(conversation?.description || '');
	const fileInputRef = useRef(null);
	const searchInputRef = useRef(null);

	// Position for desktop
	useEffect(() => {
		if (!isOpen || isMobile) return;
		const anchor = anchorRef?.current;
		const pop = popRef?.current;
		if (!anchor || !pop) return;

		const compute = () => {
			const a = anchor.getBoundingClientRect();
			const p = pop.getBoundingClientRect();
			const gap = 8;
			const prefersRight = window.innerWidth - a.right > p.width + gap;
			const side = prefersRight ? 'right' : 'left';
			const left = prefersRight ? a.right + gap : a.left - p.width - gap;
			let top = a.top + (a.height / 2) - (p.height / 2);
			top = Math.max(8, Math.min(top, window.innerHeight - p.height - 8));
			setPos({ top: Math.round(top), left: Math.round(left), side });
		};

		compute();
		const ro = new ResizeObserver(compute);
		ro.observe(anchor);
		window.addEventListener('resize', compute);
		window.addEventListener('scroll', compute, true);
		return () => {
			ro.disconnect();
			window.removeEventListener('resize', compute);
			window.removeEventListener('scroll', compute, true);
		};
	}, [isOpen, anchorRef, activeView, isMobile]);

	// Click outside closes on desktop
	useEffect(() => {
		if (!isOpen || isMobile) return;
		function handle(e) {
			if (!popRef.current) return;
			if (popRef.current.contains(e.target)) return;
			if (anchorRef?.current && anchorRef.current.contains(e.target)) return;
			onClose?.();
		}
		document.addEventListener('mousedown', handle);
		return () => document.removeEventListener('mousedown', handle);
	}, [isOpen, onClose, anchorRef, isMobile]);

	useEffect(() => {
		if (isOpen) {
			setActiveView('overview');
			setSearchTerm('');
			setSelectedMembers([]);
			setIsEditingDescription(false);
			setDescription(conversation?.description || '');
		}
	}, [isOpen, conversation]);

	if (!isOpen || !conversation) return null;

	const isGroupChat = conversation.type === 'group' || conversation.type === 'channel';
	const isAdmin = conversation.currentUserRole === 'admin';
	const canAddMembers = isAdmin || conversation.currentUserPermissions?.addMembers;
	const canRemoveMembers = isAdmin || conversation.currentUserRole === 'moderator';

	const getAvatarUrl = (u) => {
		if (!u) return '';
		if (u?.image) return u.image;
		const name = u?.firstName ? `${u.firstName} ${u.lastName || ''}`.trim() : u?.username || u?.email || 'U';
		return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=random&radius=50`;
	};

	const getUserDisplayName = (u) => {
		if (!u) return 'Unknown';
		const full = `${u.firstName || ''} ${u.lastName || ''}`.trim();
		return full || u.username || u.email || 'Unknown';
	};

	const availableUsers = allUsers.filter(user =>
		user.id !== currentUser?._id &&
		!conversation.participants.some(p => p._id === user.id)
	);

	const filteredAvailableUsers = availableUsers.filter(user => {
		if (!searchTerm.trim()) return true;
		const s = searchTerm.toLowerCase();
		return getUserDisplayName(user).toLowerCase().includes(s) ||
			(user.username || '').toLowerCase().includes(s) ||
			(user.email || '').toLowerCase().includes(s);
	});

	const filteredMembers = conversation.participants.filter(member => {
		if (!searchTerm.trim()) return true;
		const s = searchTerm.toLowerCase();
		return getUserDisplayName(member).toLowerCase().includes(s);
	});

	const toggleSelect = (id) => {
		setSelectedMembers(prev =>
			prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
		);
	};

	const handleAddSelected = async () => {
		if (selectedMembers.length && onAddMembers) {
			await onAddMembers(selectedMembers);
			setActiveView('members');
			setSelectedMembers([]);
			setSearchTerm('');
		}
	};

	const handleSaveDescription = async () => {
		if (onUpdateGroup) {
			await onUpdateGroup({ description: description.trim() });
			setIsEditingDescription(false);
		}
	};

	const handleAvatarChange = async (e) => {
		const file = e.target.files?.[0];
		if (file && onUpdateGroup) {
			await onUpdateGroup({ avatar: file });
		}
	};

	// Content for right pane based on activeView
	const RightContent = () => {
		if (activeView === 'overview') {
			return (
				<ScrollArea className="p-4 max-h-[56vh]">
					<div className="space-y-5">
						<div>
							<div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
								Created
							</div>
							<div className="text-sm text-gray-800 dark:text-gray-200">
								{new Date(conversation.time).toLocaleDateString('en-US', {
									year: 'numeric',
									month: 'long',
									day: 'numeric',
									hour: '2-digit',
									minute: '2-digit'
								})}
							</div>
						</div>

						<div>
							<div className="flex items-center justify-between mb-2">
								<div className="text-xs font-medium text-gray-500 dark:text-gray-400">
									Description
								</div>
								{isAdmin && !isEditingDescription && (
									<button
										onClick={() => setIsEditingDescription(true)}
										className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
									>
										<Edit2 className="w-3 h-3" />
										Edit
									</button>
								)}
							</div>
							{isEditingDescription ? (
								<div className="space-y-2">
									<textarea
										value={description}
										onChange={(e) => setDescription(e.target.value)}
										placeholder="Add group description..."
										className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-500"
										rows={3}
										maxLength={500}
									/>
									<div className="flex gap-2">
										<Button
											size="sm"
											onClick={handleSaveDescription}
											className="bg-green-600 hover:bg-green-700"
										>
											Save
										</Button>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => {
												setIsEditingDescription(false);
												setDescription(conversation?.description || '');
											}}
										>
											Cancel
										</Button>
									</div>
								</div>
							) : (
								<div className="text-sm text-gray-700 dark:text-gray-300">
									{conversation.description || (
										<span className="text-gray-400 dark:text-gray-500 italic">
											Add group description
										</span>
									)}
								</div>
							)}
						</div>

						<div className="pt-3 border-t border-gray-100 dark:border-gray-800">
							<button
								onClick={() => conversation.isMuted ? onUnmuteConversation?.() : onMuteConversation?.()}
								className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
							>
								{conversation.isMuted ? (
									<BellOff className="w-5 h-5 text-gray-600 dark:text-gray-400" />
								) : (
									<Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
								)}
								<div className="flex-1 text-left">
									<div className="text-sm font-medium text-gray-900 dark:text-gray-100">
										{conversation.isMuted ? 'Unmute notifications' : 'Mute notifications'}
									</div>
									<div className="text-xs text-gray-500 dark:text-gray-400">
										{conversation.isMuted ? 'You won\'t receive notifications' : 'Get notifications for new messages'}
									</div>
								</div>
							</button>
						</div>

						<div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
							<button
								onClick={onLeaveGroup}
								className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
							>
								<LogOut className="w-5 h-5" />
								<div className="text-sm font-medium">Exit group</div>
							</button>
						</div>
					</div>
				</ScrollArea>
			);
		}

		if (activeView === 'members') {
			return (
				<div className="flex flex-col h-full">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
						<div className="flex items-center justify-between mb-3">
							<div className="text-sm font-semibold text-gray-900 dark:text-white">
								{conversation.participants?.length || 0} members
							</div>
							{canAddMembers && (
								<Button
									size="sm"
									onClick={() => {
										setActiveView('addMembers');
										setSelectedMembers([]);
										setSearchTerm('');
									}}
									className="bg-green-600 hover:bg-green-700"
								>
									<UserPlus className="w-4 h-4 mr-1" />
									Add
								</Button>
							)}
						</div>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<input
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Search members..."
								className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					</div>

					<ScrollArea className="flex-1 p-2">
						{filteredMembers.map(member => {
							const isYou = member._id === currentUser?._id;
							const canRemove = canRemoveMembers && !isYou && member.role !== 'admin';
							return (
								<div
									key={member._id}
									className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
								>
									<Avatar className="w-10 h-10">
										<AvatarImage src={getAvatarUrl(member)} alt={getUserDisplayName(member)} />
										<AvatarFallback className="bg-gray-200 dark:bg-gray-700">
											{getUserDisplayName(member).charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium text-gray-900 dark:text-white truncate">
											{getUserDisplayName(member)}
											{isYou && <span className="text-gray-500 dark:text-gray-400 ml-1">(You)</span>}
										</div>
										<div className="text-xs text-gray-500 dark:text-gray-400 truncate">
											{member.role === 'admin' ? (
												<span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
													<Shield className="w-3 h-3" />
													Group Admin
												</span>
											) : member.role === 'moderator' ? (
												<span className="text-blue-600 dark:text-blue-400">Moderator</span>
											) : (
												member.bio || member.username || member.email
											)}
										</div>
									</div>
									{canRemove && (
										<button
											onClick={() => onRemoveMember?.(member._id)}
											className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
										>
											Remove
										</button>
									)}
								</div>
							);
						})}
						{filteredMembers.length === 0 && (
							<div className="text-center py-8 text-sm text-gray-500">
								No members found
							</div>
						)}
					</ScrollArea>
				</div>
			);
		}

		if (activeView === 'addMembers') {
			return (
				<div className="flex flex-col h-full">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
						<div className="flex items-center gap-3 mb-3">
							<button
								onClick={() => {
									setActiveView('members');
									setSelectedMembers([]);
									setSearchTerm('');
								}}
								className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
							>
								<ArrowLeft className="w-5 h-5" />
							</button>
							<div>
								<div className="text-sm font-semibold text-gray-900 dark:text-white">
									Add members
								</div>
								<div className="text-xs text-gray-500 dark:text-gray-400">
									{selectedMembers.length} selected
								</div>
							</div>
						</div>
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<input
								ref={searchInputRef}
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Search contacts..."
								className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					</div>

					<ScrollArea className="flex-1 p-2">
						{filteredAvailableUsers.map(u => {
							const picked = selectedMembers.includes(u.id);
							return (
								<button
									key={u.id}
									onClick={() => toggleSelect(u.id)}
									className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
								>
									<Avatar className="w-10 h-10">
										<AvatarImage src={getAvatarUrl(u)} alt={getUserDisplayName(u)} />
										<AvatarFallback className="bg-gray-200 dark:bg-gray-700">
											{getUserDisplayName(u).charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1 text-left min-w-0">
										<div className="text-sm font-medium text-gray-900 dark:text-white truncate">
											{getUserDisplayName(u)}
										</div>
										<div className="text-xs text-gray-500 dark:text-gray-400 truncate">
											{u.bio || u.username || u.email}
										</div>
									</div>
									<div
										className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${picked
											? 'bg-green-600 border-green-600'
											: 'border-gray-300 dark:border-gray-600'
											}`}
									>
										{picked && <Check className="w-3 h-3 text-white" />}
									</div>
								</button>
							);
						})}
						{filteredAvailableUsers.length === 0 && (
							<div className="text-center py-8 text-sm text-gray-500">
								{searchTerm ? 'No contacts found' : 'No available contacts'}
							</div>
						)}
					</ScrollArea>

					<div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
						<Button
							onClick={handleAddSelected}
							disabled={selectedMembers.length === 0}
							className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Add {selectedMembers.length > 0 && `(${selectedMembers.length})`}
						</Button>
					</div>
				</div>
			);
		}

		// Fallback placeholders for other tabs
		if (activeView === 'media') return (
			<div className="p-6 text-center text-sm text-gray-500">
				<Image className="w-12 h-12 mx-auto mb-2 text-gray-400" />
				No media yet
			</div>
		);
		if (activeView === 'files') return (
			<div className="p-6 text-center text-sm text-gray-500">
				<FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
				No files yet
			</div>
		);
		if (activeView === 'links') return (
			<div className="p-6 text-center text-sm text-gray-500">
				<LinkIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
				No links yet
			</div>
		);
		if (activeView === 'events') return (
			<div className="p-6 text-center text-sm text-gray-500">
				<Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
				No events yet
			</div>
		);
		if (activeView === 'encryption') return (
			<div className="p-6">
				<div className="text-center mb-4">
					<Shield className="w-12 h-12 mx-auto mb-2 text-green-600" />
				</div>
				<p className="text-sm text-gray-700 dark:text-gray-300 text-center">
					Messages are end-to-end encrypted. No one outside this chat, not even us, can read them.
				</p>
			</div>
		);

		return null;
	};

	// Left navigation item
	const LeftNav = ({ item }) => {
		const active = activeView === item.key;
		return (
			<button
				onClick={() => setActiveView(item.key)}
				className={`w-full text-left px-3 py-3 flex items-center gap-2 transition-colors ${active
					? 'bg-white dark:bg-gray-900 font-medium border-l-4 border-green-600 text-green-600 dark:text-green-400'
					: 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
					}`}
			>
				<item.Icon className="w-4 h-4" />
				<span className="truncate text-sm">{item.label}</span>
			</button>
		);
	};

	// Desktop version
	const DesktopPopover = (
		<div
			ref={popRef}
			role="dialog"
			aria-modal="false"
			id="group-info-popover"
			className="z-[9999] w-[380px] max-h-[80vh] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden"
			style={{
				position: 'fixed',
				top: pos.top,
				left: pos.left,
				transformOrigin: pos.side === 'right' ? 'left center' : 'right center',
			}}
		>
			<div
				style={pos.side === 'right' ? { left: '-6px' } : { right: '-6px' }}
				className="absolute top-8"
			>
				<div className="w-3 h-3 rotate-45 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700" />
			</div>

			{/* Header */}
			<div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
				<div className="relative">
					<Avatar className="w-14 h-14">
						<AvatarImage
							src={conversation.avatar || getAvatarUrl({ firstName: conversation.name })}
							alt={conversation.name}
						/>
						<AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-xl font-semibold">
							{conversation.name?.charAt(0)?.toUpperCase()}
						</AvatarFallback>
					</Avatar>
					{isAdmin && (
						<>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleAvatarChange}
							/>
							<button
								onClick={() => fileInputRef.current?.click()}
								className="absolute -bottom-1 -right-1 bg-green-600 w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-green-700 transition-colors shadow-md"
								title="Change group icon"
							>
								<Camera className="w-4 h-4" />
							</button>
						</>
					)}
				</div>

				<div className="flex-1 min-w-0">
					<div className="text-base font-semibold text-gray-900 dark:text-white truncate">
						{conversation.name}
					</div>
					<div className="text-xs text-gray-500 dark:text-gray-400">
						Group · {conversation.memberCount || conversation.participants?.length || 0} members
					</div>
				</div>

				<button
					onClick={onClose}
					className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
				>
					<X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
				</button>
			</div>

			<div className="flex" style={{ minHeight: 280 }}>
				<div className="w-36 border-r border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-transparent">
					{NAV.map(n => (isGroupChat || n.key !== 'members') && <LeftNav key={n.key} item={n} />)}
				</div>

				<div className="flex-1 bg-white dark:bg-gray-900">
					<div className="px-4 py-3 border-b border-gray-50 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
						<div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
							{NAV.find(n => n.key === activeView)?.label}
						</div>
					</div>
					<RightContent />
				</div>
			</div>
		</div>
	);

	// Mobile full-screen sheet
	const MobileSheet = (
		<div className="fixed inset-0 z-[9999] bg-white dark:bg-gray-900 flex flex-col">
			{/* Header */}
			<div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
				<button
					onClick={onClose}
					className="p-2 -ml-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
				>
					<ArrowLeft className="w-5 h-5" />
				</button>
				<div className="flex-1">
					<div className="text-base font-semibold text-gray-900 dark:text-white">
						{NAV.find(n => n.key === activeView)?.label}
					</div>
					<div className="text-xs text-gray-500 dark:text-gray-400">
						{isGroupChat ? `${conversation.participants?.length || 0} members` : ''}
					</div>
				</div>
			</div>

			{/* Horizontal tabs */}
			<div className="px-2 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-hide">
				<div className="inline-flex gap-2">
					{NAV.map(n => (isGroupChat || n.key !== 'members') && (
						<button
							key={n.key}
							onClick={() => setActiveView(n.key)}
							className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${activeView === n.key
								? 'bg-green-600 text-white'
								: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
								}`}
						>
							<n.Icon className="w-4 h-4" />
							<span>{n.label}</span>
						</button>
					))}
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 overflow-auto">
				<RightContent />
			</div>
		</div>
	);

	return createPortal(isMobile ? MobileSheet : DesktopPopover, document.body);
};

export default GroupInfoPopover;