import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useContactsStore } from '@/store/contactsStore';
import { useConversationStore } from '@/store/conversationStore';
import { Search, Users, UserPlus, Loader2, X, ArrowLeft, Camera, Check } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';

const NewChatModal = ({ isOpen, onClose, isMobile: forcedMobile = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('main');
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState(null);
  const searchInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const { setSelectedChat } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const {
    searchUsers,
    searchResults,
    clearSearchResults,
    isSearching,
    allUsers,
    fetchAllUsers,
  } = useContactsStore();

  const {
    createDirectConversation,
    createGroupOrChannel,
    isLoading,
    error: conversationError,
    clearError,
  } = useConversationStore();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      clearSearchResults();
      clearError();
      setView('main');
      setSelectedContacts([]);
      setGroupName('');
      setGroupAvatar(null);
      setGroupAvatarPreview(null);
    } else {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, clearSearchResults, clearError]);

  // Fetch all users when entering contact selection view
  useEffect(() => {
    if (view === 'selectContacts' && allUsers.length === 0) {
      fetchAllUsers();
    }
  }, [view, allUsers.length, fetchAllUsers]);

  // Debounced search - only for main view
  useEffect(() => {
    if (view !== 'main') return;

    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length > 0) {
        await searchUsers(searchTerm.trim());
      } else {
        clearSearchResults();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, searchUsers, clearSearchResults, view]);

  const handleSelectUser = async (user) => {
    if (isLoading) return;

    try {
      const conversation = await createDirectConversation(user.id || user._id);

      if (conversation && conversation.conversationId) {
        setSelectedChat(conversation.conversationId);
        onClose();
      }
    } catch (error) {
      console.error("Error starting new chat:", error);
    }
  };

  const handleNewGroup = () => {
    setView('selectContacts');
    setSearchTerm('');
    clearSearchResults();
  };

  const handleNewContact = () => {
    console.log('New Contact clicked');
    onClose();
  };

  const handleMessageYourself = async () => {
    if (isLoading || !currentUser) return;

    try {
      const conversation = await createDirectConversation(currentUser._id);

      if (conversation && conversation.conversationId) {
        setSelectedChat(conversation.conversationId);
        onClose();
      }
    } catch (error) {
      console.error("Error starting 'message yourself' chat:", error);
    }
  };

  const handleBackToMain = () => {
    setView('main');
    setSelectedContacts([]);
    setSearchTerm('');
    clearSearchResults();
  };

  const handleBackToSelectContacts = () => {
    setView('selectContacts');
    setGroupName('');
    setGroupAvatar(null);
    setGroupAvatarPreview(null);
  };

  const handleToggleContact = (userId) => {
    setSelectedContacts(prev => {
      if (prev.includes(userId)) {
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleNextToConfigureGroup = () => {
    if (selectedContacts.length < 2) return;
    setView('configureGroup');
    setSearchTerm('');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setGroupAvatar(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateGroup = async () => {
    if (isLoading || selectedContacts.length < 2) return;

    try {
      const participantIds = selectedContacts.map(userId => userId);

      const groupData = {
        type: 'group',
        name: groupName.trim() || getDefaultGroupName(),
        description: '',
        participants: participantIds,
        settings: {},
        isPublic: false,
        category: 'general',
        tags: [],
        avatar: groupAvatar,
      };

      const conversation = await createGroupOrChannel(groupData);

      if (conversation && conversation.conversationId) {
        setSelectedChat(conversation.conversationId);
        onClose();
      }
    } catch (error) {
      console.error("Error creating group:", error);
    }
  };

  const handleCancelSelection = () => {
    setSelectedContacts([]);
  };

  const getDefaultGroupName = () => {
    const selectedUsers = allUsers.filter(user => selectedContacts.includes(user.id));
    const names = selectedUsers.slice(0, 3).map(user =>
      user.firstName || user.username || user.label?.split(' ')[0] || user.email.split('@')[0]
    );

    if (names.length === 0) return 'New Group';
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} and ${selectedContacts.length - 2} other${selectedContacts.length - 2 > 1 ? 's' : ''}`;
  };

  const getAvatarUrl = (user) => {
    if (user?.image) return user.image;
    const name = getUserDisplayName(user);
    return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=random&radius=50`;
  };

  const getUserDisplayName = (user) => {
    if (user?.label) return user.label;
    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    return fullName || user?.username || user?.email || 'Unknown User';
  };

  const getUserSecondaryInfo = (user) => {
    if (user?.bio && user.bio.trim()) return user.bio;
    if (user?.username) return `@${user.username}`;
    return user?.email || '';
  };

  const filteredResults = searchResults.filter(
    user => user.id !== currentUser?._id
  );

  // Get contacts list based on view
  const getContactsList = () => {
    if (view === 'main' && searchTerm.trim().length > 0) {
      return filteredResults;
    } else if (view === 'selectContacts') {
      const userList = allUsers.filter(user => user.id !== currentUser?._id);

      if (searchTerm.trim().length > 0) {
        const searchLower = searchTerm.toLowerCase();
        return userList.filter(user => {
          const displayName = getUserDisplayName(user).toLowerCase();
          const username = user.username?.toLowerCase() || '';
          const email = user.email?.toLowerCase() || '';
          const bio = user.bio?.toLowerCase() || '';

          return displayName.includes(searchLower) ||
            username.includes(searchLower) ||
            email.includes(searchLower) ||
            bio.includes(searchLower);
        });
      }
      return userList;
    }
    return [];
  };

  const contactsList = getContactsList();

  // Calculate dynamic height
  const calculateHeight = () => {
    const headerHeight = 56;
    const searchBarHeight = view !== 'configureGroup' ? 56 : 0;
    const actionItemsHeight = view === 'main' ? 192 : 0;
    const selectedContactsBarHeight = view === 'selectContacts' && selectedContacts.length > 0 ? 70 : 0;
    const configureFormHeight = view === 'configureGroup' ? 280 : 0;
    const buttonBarHeight = view !== 'main' ? 64 : 0;
    const maxHeight = window.innerHeight - 96;
    const minContentHeight = 120;

    const baseHeight = headerHeight + searchBarHeight + actionItemsHeight + selectedContactsBarHeight + configureFormHeight + buttonBarHeight;

    if (view === 'main') {
      if (searchTerm.trim().length > 0) {
        if (isSearching) {
          return Math.min(baseHeight + 100, maxHeight);
        } else if (filteredResults.length > 0) {
          const resultsHeight = 36 + (filteredResults.length * 72);
          return Math.min(baseHeight + resultsHeight, maxHeight);
        } else {
          return Math.min(baseHeight + minContentHeight, maxHeight);
        }
      }
      return Math.min(baseHeight + minContentHeight, maxHeight);
    } else if (view === 'selectContacts') {
      const resultsHeight = contactsList.length * 72;
      return Math.min(baseHeight + Math.max(resultsHeight, minContentHeight), maxHeight);
    } else if (view === 'configureGroup') {
      return Math.min(baseHeight + 100, maxHeight);
    }

    return Math.min(baseHeight + minContentHeight, maxHeight);
  };

  const renderHeader = () => {
    if (view === 'main') {
      return (
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New chat</h2>
        </div>
      );
    } else if (view === 'selectContacts') {
      return (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToMain}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            </button>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New group</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedContacts.length > 0 ? `${selectedContacts.length} selected` : 'Select at least 2 contacts'}
              </p>
            </div>
          </div>
        </div>
      );
    } else if (view === 'configureGroup') {
      return (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex items-center gap-4">
          <button
            onClick={handleBackToSelectContacts}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New group</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">{selectedContacts.length} participants</p>
          </div>
        </div>
      );
    }
  };

  const renderSearchBar = () => {
    if (view === 'configureGroup') return null;

    return (
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={view === 'selectContacts' ? "Search name or number" : "Search name or number"}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isLoading}
            className="w-full pl-9 pr-9 py-2.5 text-sm bg-gray-100 dark:bg-gray-800 border-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderMainView = () => (
    <>
      {/* Fixed Action Items */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleNewGroup}
          disabled={isLoading}
          className="w-full flex items-center px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center mr-4 flex-shrink-0">
            <Users size={20} className="text-white" />
          </div>
          <span className="text-[15px] font-normal text-gray-900 dark:text-white">New group</span>
        </button>

        <button
          onClick={handleNewContact}
          disabled={isLoading}
          className="w-full flex items-center px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center mr-4 flex-shrink-0">
            <UserPlus size={20} className="text-white" />
          </div>
          <span className="text-[15px] font-normal text-gray-900 dark:text-white">New contact</span>
        </button>

        {currentUser && (
          <button
            onClick={handleMessageYourself}
            disabled={isLoading}
            className="w-full flex items-center px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Avatar className="w-10 h-10 mr-4 flex-shrink-0">
              <AvatarImage
                src={getAvatarUrl(currentUser)}
                alt={getUserDisplayName(currentUser)}
              />
              <AvatarFallback className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-semibold">
                {getUserDisplayName(currentUser).charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-[15px] font-normal text-gray-900 dark:text-white">
                {getUserDisplayName(currentUser)} (You)
              </span>
              <span className="text-[13px] text-gray-500 dark:text-gray-400">
                Message yourself
              </span>
            </div>
          </button>
        )}
      </div>

      {/* Scrollable Results Area */}
      <ScrollArea className="flex-1 overflow-y-auto">
        {isSearching && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-green-500 mr-2" size={16} />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Searching...
            </span>
          </div>
        )}

        {!isSearching && searchTerm.trim().length > 0 && filteredResults.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/30">
              CONTACTS
            </div>
            {filteredResults.map((user) => (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user)}
                disabled={isLoading}
                className="w-full flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Avatar className="w-10 h-10 mr-3 flex-shrink-0">
                  <AvatarImage
                    src={getAvatarUrl(user)}
                    alt={getUserDisplayName(user)}
                  />
                  <AvatarFallback className="text-sm font-semibold">
                    {getUserDisplayName(user).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {getUserDisplayName(user)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {getUserSecondaryInfo(user)}
                  </p>
                </div>
                {isLoading && (
                  <Loader2
                    className="animate-spin text-green-500 flex-shrink-0 ml-2"
                    size={14}
                  />
                )}
              </button>
            ))}
          </>
        )}

        {!isSearching && searchTerm.trim().length > 0 && filteredResults.length === 0 && (
          <div className="text-center py-8 px-4">
            <div className="text-gray-500 dark:text-gray-400">
              <Search size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">No results found for "{searchTerm}"</p>
              <p className="text-xs mt-1 opacity-75">Try a different search term</p>
            </div>
          </div>
        )}

        {!isSearching && searchTerm.trim().length === 0 && (
          <div className="text-center py-6 px-4">
            <div className="text-gray-500 dark:text-gray-400">
              <Search size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Search for contacts to start chatting</p>
            </div>
          </div>
        )}
      </ScrollArea>
    </>
  );

  const renderSelectContactsView = () => (
    <>
      {/* Selected Contacts Bar - Chip Style */}
      {selectedContacts.length > 0 && (
        <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700 px-4 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
              {selectedContacts.length} selected
            </span>
            <button
              onClick={handleCancelSelection}
              className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium"
            >
              Cancel selection
            </button>
          </div>
          <ScrollArea className="w-full">
            <div className="flex flex-wrap gap-1.5 pb-1">
              {selectedContacts.map(userId => {
                const user = allUsers.find(u => u.id === userId);
                if (!user) return null;
                const displayName = user.firstName || user.username || user.label?.split(' ')[0] || user.email.split('@')[0];
                return (
                  <div
                    key={userId}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 rounded-full border border-green-200 dark:border-green-800"
                  >
                    <span className="text-xs font-medium text-green-800 dark:text-green-300 max-w-[100px] truncate">
                      {displayName}
                    </span>
                    <button
                      onClick={() => handleToggleContact(userId)}
                      className="flex-shrink-0 hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3 text-green-700 dark:text-green-400" />
                    </button>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Contacts List */}
      <ScrollArea className="flex-1 overflow-y-auto">
        {contactsList.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/30">
              ALL CONTACTS
            </div>
            {contactsList.map((user) => {
              const isSelected = selectedContacts.includes(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => handleToggleContact(user.id)}
                  className="w-full flex items-center px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  <Avatar className="w-10 h-10 mr-3 flex-shrink-0">
                    <AvatarImage
                      src={getAvatarUrl(user)}
                      alt={getUserDisplayName(user)}
                    />
                    <AvatarFallback className="text-sm font-semibold">
                      {getUserDisplayName(user).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {getUserDisplayName(user)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {getUserSecondaryInfo(user)}
                    </p>
                  </div>
                  <div className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${isSelected
                    ? 'bg-green-500 border-green-500'
                    : 'border-gray-300 dark:border-gray-600'
                    }`}>
                    {isSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                </button>
              );
            })}
          </>
        )}

        {contactsList.length === 0 && !isSearching && (
          <div className="text-center py-8 px-4">
            <div className="text-gray-500 dark:text-gray-400">
              <Users size={32} className="mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {searchTerm.trim().length > 0 ? 'No contacts found' : 'No contacts available'}
              </p>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Next Button */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
        <button
          onClick={handleNextToConfigureGroup}
          disabled={selectedContacts.length < 2}
          className="w-full py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {selectedContacts.length < 2
            ? `Select at least ${2 - selectedContacts.length} more`
            : 'Next'}
        </button>
      </div>
    </>
  );

  const renderConfigureGroupView = () => (
    <>
      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Avatar Upload */}
          <div className="flex justify-center">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors overflow-hidden"
              >
                {groupAvatarPreview ? (
                  <img src={groupAvatarPreview} alt="Group avatar" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                )}
              </button>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <Camera className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Add group icon <span className="text-gray-400 dark:text-gray-500">(optional)</span>
            </p>
          </div>

          {/* Group Name Input */}
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

          {/* Selected Members Preview */}
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
              PARTICIPANTS · {selectedContacts.length}
            </p>
            <div className="space-y-2">
              {selectedContacts.slice(0, 3).map(userId => {
                const user = allUsers.find(u => u.id === userId);
                if (!user) return null;
                return (
                  <div key={userId} className="flex items-center">
                    <Avatar className="w-9 h-9 mr-3">
                      <AvatarImage
                        src={getAvatarUrl(user)}
                        alt={getUserDisplayName(user)}
                      />
                      <AvatarFallback className="text-xs font-semibold">
                        {getUserDisplayName(user).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-gray-900 dark:text-white">
                      {getUserDisplayName(user)}
                    </span>
                  </div>
                );
              })}
              {selectedContacts.length > 3 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 pl-12">
                  and {selectedContacts.length - 3} more...
                </p>
              )}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* Action Buttons */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4 flex gap-3">
        <button
          onClick={handleBackToSelectContacts}
          disabled={isLoading}
          className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleCreateGroup}
          disabled={isLoading || selectedContacts.length < 2}
          className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin mr-2" size={16} />
              Creating...
            </>
          ) : (
            'Create'
          )}
        </button>
      </div>
    </>
  );

  const isMobile = forcedMobile || useIsMobile();

  if (!isOpen) return null;

  const desktopHeight = `${calculateHeight()}px`;

  return (
    <div
      className={`flex flex-col border-0 overflow-hidden shadow-xl ${isMobile ? 'rounded-2xl bg-white dark:bg-gray-900 h-[85vh]' : 'rounded-lg bg-white dark:bg-gray-900'}`}
      style={{
        height: isMobile ? 'auto' : desktopHeight,
        minHeight: isMobile ? '70vh' : '360px',
        maxHeight: isMobile ? '85vh' : 'calc(100vh - 6rem)',
        transition: 'height 0.2s ease-out'
      }}
    >
      {renderHeader()}
      {renderSearchBar()}

      {/* Error Message */}
      {conversationError && (
        <div className="mx-4 mt-2 mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex-shrink-0">
          <p className="text-xs text-red-800 dark:text-red-200">
            {conversationError}
          </p>
        </div>
      )}

      {view === 'main' && renderMainView()}
      {view === 'selectContacts' && renderSelectContactsView()}
      {view === 'configureGroup' && renderConfigureGroupView()}
    </div>
  );
};

export default NewChatModal;