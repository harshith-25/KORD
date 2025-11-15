import { useEffect, useMemo, useRef, useState } from 'react';
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

const normalizeId = (u) => u?._id || u?.id || u;

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
	onCreateGroupFromDirect, // optional
	onApproveJoinRequest, // optional
	onRejectJoinRequest, // optional
	allUsers = [],
	isMobile = false,
}) => {
	const popRef = useRef(null);
	const [pos, setPos] = useState({ top: 0, left: 0, side: 'right' });
	const [activeView, setActiveView] = useState('overview');

	// shared UI state
	const [searchTerm, setSearchTerm] = useState('');
	const [busy, setBusy] = useState(false);

	// chips + multiselect
	const [selectedMembers, setSelectedMembers] = useState([]);
	const searchInputRef = useRef(null);

	// description edit
	const [isEditingDescription, setIsEditingDescription] = useState(false);
	const [description, setDescription] = useState(conversation?.description || '');

	// DM → Create group configure
	const [groupName, setGroupName] = useState('');
	const [groupAvatar, setGroupAvatar] = useState(null);
	const [groupAvatarPreview, setGroupAvatarPreview] = useState(null);
	const headerAvatarInputRef = useRef(null);  // header avatar button
	const configureAvatarInputRef = useRef(null); // configure view avatar button

	// layout: ensure real, smooth scroll
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
			let top = a.top + a.height / 2 - p.height / 2;
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

	// close on outside click (desktop)
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

	// reset on open
	useEffect(() => {
		if (isOpen) {
			setActiveView('overview');
			setSearchTerm('');
			setSelectedMembers([]);
			setIsEditingDescription(false);
			setDescription(conversation?.description || '');
			setGroupName('');
			setGroupAvatar(null);
			setGroupAvatarPreview(null);
		}
	}, [isOpen, conversation?.description]);

	if (!isOpen || !conversation) return null;

	const isGroupChat = conversation.type === 'group' || conversation.type === 'channel';
	const isDirectChat = conversation.type === 'direct';
	const isAdmin = conversation.currentUserRole === 'admin';
	const isModerator = conversation.currentUserRole === 'moderator';
	const allowModeratorsToApprove = conversation.settings?.allowModeratorsToApprove || false;

	const canAddMembers =
		(isGroupChat && (isAdmin || conversation.currentUserPermissions?.canAddMembers || conversation.currentUserPermissions?.addMembers)) ||
		isDirectChat;

	const canRemoveMembers =
		isGroupChat && (isAdmin || conversation.currentUserRole === 'moderator');

	const canApproveRequests = isAdmin || (isModerator && allowModeratorsToApprove);

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

	const participantIds = useMemo(
		() => new Set((conversation.participants || []).map(p => normalizeId(p))),
		[conversation.participants]
	);

	// “other user” in DM
	const otherUserId = useMemo(() => {
		if (!isDirectChat) return null;
		const me = normalizeId(currentUser);
		const other = (conversation.participants || []).find(p => normalizeId(p) !== me);
		return normalizeId(other);
	}, [isDirectChat, conversation.participants, currentUser]);

	// Available users (exclude anyone already inside)
	const availableUsers = useMemo(() => {
		return (allUsers || [])
			.filter(u => {
				const id = normalizeId(u);
				if (!id) return false;
				// block: already in conversation
				if (participantIds.has(id)) return false;
				return true;
			})
			.map(u => ({ ...u, _id: normalizeId(u) }));
	}, [allUsers, participantIds]);

	const filteredAvailableUsers = useMemo(() => {
		if (!searchTerm.trim()) return availableUsers;
		const s = searchTerm.toLowerCase();
		return availableUsers.filter(user =>
			getUserDisplayName(user).toLowerCase().includes(s) ||
			(user.username || '').toLowerCase().includes(s) ||
			(user.email || '').toLowerCase().includes(s)
		);
	}, [availableUsers, searchTerm]);

	const filteredMembers = useMemo(() => {
		const memb = conversation.participants || [];
		if (!searchTerm.trim()) return memb;
		const s = searchTerm.toLowerCase();
		return memb.filter(member => getUserDisplayName(member).toLowerCase().includes(s));
	}, [conversation.participants, searchTerm]);

	const toggleSelect = (id) => {
		setSelectedMembers(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
	};

	// GROUP: confirm add
	const handleAddSelectedToGroup = async () => {
		if (!selectedMembers.length || !onAddMembers) return;
		setBusy(true);
		try {
			await onAddMembers(selectedMembers);
			// reset to members view
			setActiveView('members');
			setSelectedMembers([]);
			setSearchTerm('');
		} finally {
			setBusy(false);
		}
	};

	// DM → “Create group” confirm
	const handleCreateGroupFromDirect = async () => {
		if (!isDirectChat) return;
		if (!onCreateGroupFromDirect) return;

		const mandatory = otherUserId ? [otherUserId] : [];
		const unique = Array.from(new Set([...mandatory, ...selectedMembers].filter(Boolean)));
		// WhatsApp-like guard: you must have at least 2 participants (you’re implicit)
		if (unique.length < 1) return;

		setBusy(true);
		try {
			await onCreateGroupFromDirect({
				participantIds: unique,
				name: (groupName || '').trim() || undefined,
				avatarFile: groupAvatar || null,
			});
			onClose?.();
		} finally {
			setBusy(false);
		}
	};

	// Save description
	const handleSaveDescription = async () => {
		if (!onUpdateGroup) return;
		setBusy(true);
		try {
			const trimmed = (description || '').trim();
			await onUpdateGroup({ description: trimmed });
			setIsEditingDescription(false);
		} finally {
			setBusy(false);
		}
	};

	// Avatar handling:
	// - Groups: header avatar changes group icon
	// - DMs: header button chooses avatar for the *new* group (optional)
	const handleHeaderAvatarChange = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (isGroupChat) {
			if (!onUpdateGroup) return;
			setBusy(true);
			try {
				const fd = new FormData();
				fd.append('avatar', file);
				await onUpdateGroup(fd);
			} finally {
				setBusy(false);
				e.target.value = '';
			}
		} else if (isDirectChat) {
			setGroupAvatar(file);
			const r = new FileReader();
			r.onloadend = () => setGroupAvatarPreview(r.result);
			r.readAsDataURL(file);
		}
	};

	const handleConfigureAvatarChange = (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setGroupAvatar(file);
		const r = new FileReader();
		r.onloadend = () => setGroupAvatarPreview(r.result);
		r.readAsDataURL(file);
	};

	// ======= RIGHT CONTENT (scrollable pane) =======
	const RightContent = () => {
		// OVERVIEW
		if (activeView === 'overview') {
			const created = conversation.time || conversation.lastActivity || Date.now();

			return (
				<div className="flex h-full flex-col">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
						<div className="text-sm font-semibold text-gray-800 dark:text-gray-200">
							Overview
						</div>
					</div>

					<ScrollArea className="flex-1 p-4">
						<div className="space-y-5">
							<div>
								<div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Created</div>
								<div className="text-sm text-gray-800 dark:text-gray-200">
									{new Date(created).toLocaleDateString('en-US', {
										year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
									})}
								</div>
							</div>

							{isGroupChat && (
								<div>
									<div className="flex items-center justify-between mb-2">
										<div className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</div>
										{isAdmin && !isEditingDescription && (
											<button
												onClick={() => setIsEditingDescription(true)}
												className="text-xs text-green-600 dark:text-green-400 hover:underline flex items-center gap-1"
												disabled={busy}
											>
												<Edit2 className="w-3 h-3" /> Edit
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
												<Button size="sm" onClick={handleSaveDescription} disabled={busy} className="bg-green-600 hover:bg-green-700 disabled:opacity-50">Save</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => { setIsEditingDescription(false); setDescription(conversation?.description || ''); }}
													disabled={busy}
												>
													Cancel
												</Button>
											</div>
										</div>
									) : (
										<div className="text-sm text-gray-700 dark:text-gray-300">
											{conversation.description ? (
												conversation.description
											) : (
												<span className="text-gray-400 dark:text-gray-500 italic">Add group description</span>
											)}
										</div>
									)}
								</div>
							)}

							{/* Mute/Unmute */}
							<div className="pt-3 border-t border-gray-100 dark:border-gray-800">
								<button
									onClick={() => conversation.isMuted ? onUnmuteConversation?.() : onMuteConversation?.()}
									className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
									disabled={busy}
								>
									{conversation.isMuted
										? <BellOff className="w-5 h-5 text-gray-600 dark:text-gray-400" />
										: <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
									}
									<div className="flex-1 text-left">
										<div className="text-sm font-medium text-gray-900 dark:text-gray-100">
											{conversation.isMuted ? 'Unmute notifications' : 'Mute notifications'}
										</div>
										<div className="text-xs text-gray-500 dark:text-gray-400">
											{conversation.isMuted ? "You won't receive notifications" : 'Get notifications for new messages'}
										</div>
									</div>
								</button>
							</div>

							{isGroupChat && (
								<div className="space-y-2 pt-3 border-t border-gray-100 dark:border-gray-800">
									<button
										onClick={onLeaveGroup}
										className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400"
										disabled={busy}
									>
										<LogOut className="w-5 h-5" />
										<div className="text-sm font-medium">Exit group</div>
									</button>
								</div>
							)}

							{/* DM: Create group CTA */}
							{isDirectChat && canAddMembers && (
								<div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
									<button
										onClick={() => {
											setActiveView('addMembers');
											setSelectedMembers([]);
											setSearchTerm('');
											setTimeout(() => searchInputRef.current?.focus(), 0);
										}}
										className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
									>
										<UserPlus className="w-5 h-5 text-green-600" />
										<div className="flex-1 text-left">
											<div className="text-sm font-medium text-gray-900 dark:text-gray-100">Create group</div>
											<div className="text-xs text-gray-500 dark:text-gray-400">Add people to start a group with this contact</div>
										</div>
									</button>
								</div>
							)}
						</div>
					</ScrollArea>
				</div>
			);
		}

		// MEMBERS
		if (activeView === 'members' && isGroupChat) {
			return (
				<div className="flex h-full flex-col">
					{/* top bar */}
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
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
										setTimeout(() => searchInputRef.current?.focus(), 0);
									}}
									className="bg-green-600 hover:bg-green-700"
									disabled={busy}
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
								className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					</div>

					{/* Join Requests Section */}
					{canApproveRequests && conversation.joinRequests && conversation.joinRequests.length > 0 && (
						<div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800">
							<div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
								JOIN REQUESTS ({conversation.joinRequests.length})
							</div>
							<div className="space-y-2">
								{conversation.joinRequests.map((req, idx) => {
									// Handle user field - can be ObjectId, populated user object, or user ID string
									let reqUserId = null;
									let reqUserObj = null;
									
									if (req.user) {
										if (typeof req.user === 'string' || req.user._id) {
											reqUserId = normalizeId(req.user);
											reqUserObj = allUsers.find(u => normalizeId(u) === reqUserId) || 
												(req.user._id ? req.user : null);
										} else {
											reqUserId = normalizeId(req.user);
											reqUserObj = allUsers.find(u => normalizeId(u) === reqUserId);
										}
									}
									
									if (!reqUserId) {
										return null; // Skip invalid requests
									}
									
									// Fallback to a minimal user object if not found
									if (!reqUserObj) {
										reqUserObj = { _id: reqUserId, firstName: 'Unknown', lastName: '' };
									}
									
									return (
										<div
											key={`${reqUserId}-${idx}`}
											className="flex items-center gap-3 px-3 py-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800"
										>
											<Avatar className="w-9 h-9">
												<AvatarImage src={getAvatarUrl(reqUserObj)} alt={getUserDisplayName(reqUserObj)} />
												<AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-xs">
													{getUserDisplayName(reqUserObj).charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<div className="text-sm font-medium text-gray-900 dark:text-white truncate">
													{getUserDisplayName(reqUserObj)}
												</div>
												{req.message && (
													<div className="text-xs text-gray-600 dark:text-gray-400 truncate">
														{req.message}
													</div>
												)}
											</div>
											<div className="flex gap-1">
												<Button
													size="sm"
													onClick={() => onApproveJoinRequest?.(reqUserId)}
													disabled={busy}
													className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-7"
												>
													Approve
												</Button>
												<Button
													size="sm"
													variant="ghost"
													onClick={() => onRejectJoinRequest?.(reqUserId)}
													disabled={busy}
													className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs px-2 py-1 h-7"
												>
													Reject
												</Button>
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Helper text if approval is required */}
					{conversation.settings?.approveNewParticipants && (
						<div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 bg-blue-50 dark:bg-blue-900/20">
							<div className="text-xs text-blue-700 dark:text-blue-300">
								ℹ️ New participants require approval
							</div>
						</div>
					)}

					{/* list */}
					<ScrollArea className="flex-1 p-2">
						{(filteredMembers || []).map((m) => {
							const id = normalizeId(m);
							const isYou = id === normalizeId(currentUser);
							const canRemove = canRemoveMembers && !isYou && m.role !== 'admin';
							return (
								<div
									key={id}
									className="flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
								>
									<Avatar className="w-10 h-10">
										<AvatarImage src={getAvatarUrl(m)} alt={getUserDisplayName(m)} />
										<AvatarFallback className="bg-gray-200 dark:bg-gray-700">
											{getUserDisplayName(m).charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="flex-1 min-w-0">
										<div className="text-sm font-medium text-gray-900 dark:text-white truncate">
											{getUserDisplayName(m)}
											{isYou && <span className="text-gray-500 dark:text-gray-400 ml-1">(You)</span>}
										</div>
										<div className="text-xs text-gray-500 dark:text-gray-400 truncate">
											{m.role === 'admin' ? (
												<span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
													<Shield className="w-3 h-3" />
													Group Admin
												</span>
											) : m.role === 'moderator' ? (
												<span className="text-blue-600 dark:text-blue-400">Moderator</span>
											) : (
												m.bio || m.username || m.email
											)}
										</div>
									</div>
									{canRemove && (
										<button
											onClick={() => onRemoveMember?.(id)}
											className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
											disabled={busy}
										>
											Remove
										</button>
									)}
								</div>
							);
						})}

						{(filteredMembers || []).length === 0 && (
							<div className="text-center py-8 text-sm text-gray-500">No members found</div>
						)}
					</ScrollArea>
				</div>
			);
		}

		// ADD MEMBERS — WhatsApp-like (chips + checkbox)
		if (activeView === 'addMembers') {
			const isCreateFlow = isDirectChat;

			return (
				<div className="flex h-full flex-col min-h-0">
					{/* header */}
					<div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
						<div className="flex items-center gap-3 mb-3">
							<button
								onClick={() => {
									setActiveView(isCreateFlow ? 'overview' : 'members');
									setSelectedMembers([]);
									setSearchTerm('');
								}}
								className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
							>
								<ArrowLeft className="w-5 h-5" />
							</button>
							<div className="flex-1 min-w-0">
								<div className="text-sm font-semibold text-gray-900 dark:text-white">
									{isCreateFlow ? 'Create group' : 'Add members'}
								</div>
								<div className="text-xs text-gray-500 dark:text-gray-400">
									{selectedMembers.length > 0 ? `${selectedMembers.length} selected` : 'Select contacts'}
								</div>
							</div>
						</div>

						{/* search */}
						<div className="relative">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
							<input
								ref={searchInputRef}
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Search name or number"
								className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
							/>
						</div>
					</div>

					{/* chips bar - horizontal scroll */}
					{selectedMembers.length > 0 && (
						<div className="flex-shrink-0 border-b border-gray-100 dark:border-gray-800 px-4 py-2.5">
							<div className="flex items-center justify-between mb-2">
								<span className="text-xs font-medium text-gray-600 dark:text-gray-400">
									{selectedMembers.length} selected
								</span>
								<button
									onClick={() => setSelectedMembers([])}
									className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
								>
									Clear all
								</button>
							</div>
							<div className="overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent pb-1 -mx-1 px-1">
								<div className="flex gap-2 min-w-min">
									{selectedMembers.map(uid => {
										const u = allUsers.find(x => normalizeId(x) === uid);
										if (!u) return null;
										const display = getUserDisplayName(u);
										return (
											<div
												key={uid}
												className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full border border-green-200 dark:border-green-800 whitespace-nowrap flex-shrink-0"
											>
												<span className="text-xs font-medium text-green-800 dark:text-green-300">
													{display}
												</span>
												<button
													onClick={() => toggleSelect(uid)}
													className="flex-shrink-0 hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5 transition-colors"
												>
													<X className="h-3 w-3 text-green-700 dark:text-green-400" />
												</button>
											</div>
										);
									})}
								</div>
							</div>
						</div>
					)}

					{/* list of people not in the group - proper scroll area */}
					<div className="flex-1 overflow-hidden">
						<div className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
							<div className="p-2 space-y-1">
								{(filteredAvailableUsers || []).map((u) => {
									const id = normalizeId(u);
									const picked = selectedMembers.includes(id);
									return (
										<button
											key={id}
											onClick={() => toggleSelect(id)}
											className="w-full flex items-center px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
										>
											<Avatar className="w-10 h-10 mr-3 flex-shrink-0">
												<AvatarImage src={getAvatarUrl(u)} alt={getUserDisplayName(u)} />
												<AvatarFallback className="bg-gray-200 dark:bg-gray-700 text-sm">
													{getUserDisplayName(u).charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0 text-left">
												<p className="text-sm font-medium text-gray-900 dark:text-white truncate">
													{getUserDisplayName(u)}
												</p>
												<p className="text-xs text-gray-500 dark:text-gray-400 truncate">
													{u.bio || u.username || u.email}
												</p>
											</div>
											<div
												className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ml-3 ${picked
													? 'bg-green-600 border-green-600 scale-105'
													: 'border-gray-300 dark:border-gray-600 group-hover:border-gray-400 dark:group-hover:border-gray-500'
													}`}
											>
												{picked && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
											</div>
										</button>
									);
								})}

								{(filteredAvailableUsers || []).length === 0 && (
									<div className="text-center py-12 px-4 text-sm text-gray-500">
										<Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
										<p className="font-medium">{searchTerm ? 'No contacts found' : 'No available contacts'}</p>
										{searchTerm && (
											<p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
												Try adjusting your search
											</p>
										)}
									</div>
								)}
							</div>
						</div>
					</div>

					{/* sticky footer action - always visible */}
					<div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 p-4 bg-white dark:bg-gray-900 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.3)]">
						{isCreateFlow ? (
							<Button
								onClick={() => setActiveView('configureGroup')}
								disabled={selectedMembers.length === 0}
								className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium shadow-sm"
							>
								Next {selectedMembers.length > 0 && `(${selectedMembers.length})`}
							</Button>
						) : (
							<Button
								onClick={handleAddSelectedToGroup}
								disabled={selectedMembers.length === 0 || busy}
								className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium shadow-sm"
							>
								{busy ? 'Adding...' : `Add ${selectedMembers.length > 0 ? `(${selectedMembers.length})` : ''}`}
							</Button>
						)}
					</div>
				</div>
			);
		}

		// DM → CONFIGURE GROUP (exactly like your modal: icon + name + preview)
		if (activeView === 'configureGroup' && isDirectChat) {
			return (
				<div className="flex h-full flex-col">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
						<div className="flex items-center gap-3">
							<button
								onClick={() => setActiveView('addMembers')}
								className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
							>
								<ArrowLeft className="w-5 h-5" />
							</button>
							<div>
								<div className="text-sm font-semibold text-gray-900 dark:text-white">New group</div>
								<div className="text-xs text-gray-500 dark:text-gray-400">
									{selectedMembers.length + (otherUserId ? 1 : 0)} participants
								</div>
							</div>
						</div>
					</div>

					<ScrollArea className="flex-1">
						<div className="p-6 space-y-6">
							{/* avatar */}
							<div className="flex justify-center">
								<div className="relative">
									<input
										ref={configureAvatarInputRef}
										type="file"
										accept="image/*"
										onChange={handleConfigureAvatarChange}
										className="hidden"
									/>
									<button
										onClick={() => configureAvatarInputRef.current?.click()}
										className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors overflow-hidden"
									>
										{groupAvatarPreview ? (
											<img src={groupAvatarPreview} alt="Group avatar" className="w-full h-full object-cover" />
										) : (
											<Camera className="h-8 w-8 text-gray-500 dark:text-gray-400" />
										)}
									</button>
									<div className="absolute bottom-0 right-0 w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
										<Camera className="h-4 w-4 text-white" />
									</div>
								</div>
							</div>
							<div className="text-center">
								<p className="text-sm text-gray-600 dark:text-gray-400">
									Add group icon <span className="text-gray-400 dark:text-gray-500">(optional)</span>
								</p>
							</div>

							{/* name */}
							<div>
								<label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
									Provide a group name
								</label>
								<input
									type="text"
									placeholder="Group name (optional)"
									value={groupName}
									onChange={(e) => setGroupName(e.target.value)}
									maxLength={100}
									className="w-full px-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
								/>
							</div>

							{/* selected preview (first few) */}
							<div>
								<p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
									PARTICIPANTS · {selectedMembers.length + (otherUserId ? 1 : 0)}
								</p>
								<div className="space-y-2">
									{[otherUserId, ...selectedMembers].filter(Boolean).slice(0, 3).map(uid => {
										const u = allUsers.find(x => normalizeId(x) === uid) ||
											(conversation.participants || []).find(x => normalizeId(x) === uid);
										if (!u) return null;
										return (
											<div key={uid} className="flex items-center">
												<Avatar className="w-9 h-9 mr-3">
													<AvatarImage src={getAvatarUrl(u)} alt={getUserDisplayName(u)} />
													<AvatarFallback className="text-xs font-semibold">
														{getUserDisplayName(u).charAt(0).toUpperCase()}
													</AvatarFallback>
												</Avatar>
												<span className="text-sm text-gray-900 dark:text-white">
													{getUserDisplayName(u)}
												</span>
											</div>
										);
									})}
									{selectedMembers.length + (otherUserId ? 1 : 0) > 3 && (
										<p className="text-xs text-gray-500 dark:text-gray-400 pl-12">
											and {selectedMembers.length + (otherUserId ? 1 : 0) - 3} more...
										</p>
									)}
								</div>
							</div>
						</div>
					</ScrollArea>

					<div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-800 p-4 flex gap-3">
						<Button
							onClick={() => setActiveView('addMembers')}
							variant="secondary"
							disabled={busy}
							className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
						>
							Back
						</Button>
						<Button
							onClick={handleCreateGroupFromDirect}
							disabled={busy || !onCreateGroupFromDirect || (selectedMembers.length === 0 && !otherUserId)}
							className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50"
						>
							{busy ? 'Creating…' : 'Create'}
						</Button>
					</div>
				</div>
			);
		}

		// simple tabs
		if (activeView === 'media') {
			return (
				<div className="flex h-full flex-col">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
						<div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Media</div>
					</div>
					<div className="flex-1 p-6 text-center text-sm text-gray-500">
						<Image className="w-12 h-12 mx-auto mb-2 text-gray-400" />
						No media yet
					</div>
				</div>
			);
		}
		if (activeView === 'files') {
			return (
				<div className="flex h-full flex-col">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
						<div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Files</div>
					</div>
					<div className="flex-1 p-6 text-center text-sm text-gray-500">
						<FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
						No files yet
					</div>
				</div>
			);
		}
		if (activeView === 'links') {
			return (
				<div className="flex h-full flex-col">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
						<div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Links</div>
					</div>
					<div className="flex-1 p-6 text-center text-sm text-gray-500">
						<LinkIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
						No links yet
					</div>
				</div>
			);
		}
		if (activeView === 'events') {
			return (
				<div className="flex h-full flex-col">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
						<div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Events</div>
					</div>
					<div className="flex-1 p-6 text-center text-sm text-gray-500">
						<Calendar className="w-12 h-12 mx-auto mb-2 text-gray-400" />
						No events yet
					</div>
				</div>
			);
		}
		if (activeView === 'encryption') {
			return (
				<div className="flex h-full flex-col">
					<div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
						<div className="text-sm font-semibold text-gray-800 dark:text-gray-200">Encryption</div>
					</div>
					<div className="flex-1 p-6">
						<div className="text-center mb-4">
							<Shield className="w-12 h-12 mx-auto mb-2 text-green-600" />
						</div>
						<p className="text-sm text-gray-700 dark:text-gray-300 text-center">
							Messages are end-to-end encrypted. No one outside this chat, not even us, can read them.
						</p>
					</div>
				</div>
			);
		}

		return null;
	};

	const LeftNav = ({ item }) => {
		const active = activeView === item.key;
		if (!isGroupChat && item.key === 'members') return null; // no members tab for DM

		return (
			<button
				onClick={() => setActiveView(item.key)}
				className={`w-full text-left px-3 py-3 flex items-center gap-2 transition-colors ${active
					? 'bg-white dark:bg-gray-900 font-medium border-l-4 border-green-600 text-green-600 dark:text-green-400'
					: 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
					}`}
				aria-current={active ? 'page' : undefined}
			>
				<span className="truncate text-sm">{item.label}</span>
			</button>
		);
	};

	// ======= DESKTOP POPOVER (fixed height + internal scroll) =======
	const DesktopPopover = (
		<div
			ref={popRef}
			role="dialog"
			aria-modal="false"
			id="group-info-popover"
			className="z-[9999] w-[420px] max-h-[80vh] rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden flex flex-col"
			style={{
				position: 'fixed',
				top: pos.top,
				left: pos.left,
				transformOrigin: pos.side === 'right' ? 'left center' : 'right center',
			}}
		>
			{/* pointer */}
			<div style={pos.side === 'right' ? { left: '-6px' } : { right: '-6px' }} className="absolute top-8">
				<div className="w-3 h-3 rotate-45 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700" />
			</div>

			{/* header */}
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

					{(isAdmin || isDirectChat) && (
						<>
							<input
								ref={headerAvatarInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleHeaderAvatarChange}
							/>
							<button
								onClick={() => headerAvatarInputRef.current?.click()}
								className="absolute -bottom-1 -right-1 bg-green-600 w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-green-700 transition-colors shadow-md disabled:opacity-50"
								title={isGroupChat ? 'Change group icon' : 'Choose group icon'}
								disabled={busy}
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
						{isGroupChat ? (
							<>Group · {conversation.memberCount || conversation.participants?.length || 0} members</>
						) : (
							'Direct chat'
						)}
					</div>
				</div>

				<button
					onClick={onClose}
					className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
					aria-label="Close"
				>
					<X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
				</button>
			</div>

			{/* body: left nav + right content (both scroll independently) */}
			<div className="flex min-h-0 flex-1">
				<div className="w-40 border-r border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-transparent">
					<ScrollArea className="h-full">
						{NAV.map((n) => <LeftNav key={n.key} item={n} />)}
					</ScrollArea>
				</div>

				<div className="flex-1 min-w-0 flex flex-col">
					<div className="min-h-0 flex-1">
						<RightContent />
					</div>
				</div>
			</div>
		</div>
	);

	// ======= MOBILE SHEET =======
	const MobileSheet = (
		<div className="fixed inset-0 z-[9999] bg-white dark:bg-gray-900 flex flex-col">
			<div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
				<button
					onClick={onClose}
					className="p-2 -ml-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
					aria-label="Close"
				>
					<ArrowLeft className="w-5 h-5" />
				</button>
				<div className="flex-1">
					<div className="text-base font-semibold text-gray-900 dark:text-white">
						{NAV.find((n) => n.key === activeView)?.label}
					</div>
					<div className="text-xs text-gray-500 dark:text-gray-400">
						{isGroupChat ? `${conversation.participants?.length || 0} members` : ''}
					</div>
				</div>
			</div>

			<div className="px-2 py-2 border-b border-gray-100 dark:border-gray-800 overflow-x-auto scrollbar-hide">
				<div className="inline-flex gap-2">
					{NAV.map(
						(n) =>
							(isGroupChat || n.key !== 'members') && (
								<button
									key={n.key}
									onClick={() => setActiveView(n.key)}
									className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors ${activeView === n.key
										? 'bg-green-600 text-white'
										: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
										}`}
								>
									<span>{n.label}</span>
								</button>
							)
					)}
				</div>
			</div>

			<div className="flex-1 min-h-0">
				<RightContent />
			</div>
		</div>
	);

	return createPortal(isMobile ? MobileSheet : DesktopPopover, document.body);
};

export default GroupInfoPopover;