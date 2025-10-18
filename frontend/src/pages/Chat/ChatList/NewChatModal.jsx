import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useContactsStore } from '@/store/contactsStore';
import { useConversationStore } from '@/store/conversationStore';
import { Search, Users, UserPlus, Loader2, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

const NewChatModal = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef(null);

  const { setSelectedChat } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const {
    searchUsers,
    searchResults,
    clearSearchResults,
    isSearching,
  } = useContactsStore();

  const {
    createDirectConversation,
    isCreatingConversation,
    error: conversationError,
    clearError
  } = useConversationStore();

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      clearSearchResults();
      clearError();
    } else {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, clearSearchResults, clearError]);

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length > 0) {
        await searchUsers(searchTerm.trim());
      } else {
        clearSearchResults();
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, searchUsers, clearSearchResults]);

  const handleSelectUser = async (user) => {
    if (isCreatingConversation) return;

    try {
      const conversation = await createDirectConversation(user._id);

      if (conversation && conversation.conversationId) {
        setSelectedChat(conversation.conversationId);
        onClose();
      }
    } catch (error) {
      console.error("Error starting new chat:", error);
    }
  };

  const handleNewGroup = () => {
    console.log('New Group clicked');
    onClose();
  };

  const handleNewContact = () => {
    console.log('New Contact clicked');
    onClose();
  };

  const handleMessageYourself = async () => {
    if (isCreatingConversation || !currentUser) return;

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

  const getAvatarUrl = (user) => {
    if (user?.image) return user.image;
    const initials = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    return `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(initials)}&backgroundColor=random&radius=50`;
  };

  const getUserDisplayName = (user) => {
    const fullName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
    return fullName || user?.email || user?.username || 'Unknown User';
  };

  const filteredResults = searchResults.filter(
    user => user._id !== currentUser?._id
  );

  // Calculate dynamic height based on content
  const calculateHeight = () => {
    const headerHeight = 56; // "New chat" header
    const searchBarHeight = 56; // Search bar with padding
    const actionItemsHeight = 192; // 3 fixed action items (New group, New contact, Message yourself) - 64px each
    const sectionHeaderHeight = 36; // "Frequently contacted" or "All contacts" header
    const itemHeight = 72; // Height per contact item
    const maxHeight = window.innerHeight - 96; // viewport height - 6rem from bottom
    const minContentHeight = 120; // Minimum scrollable area

    // Base height always includes: header + search + action items
    const baseHeight = headerHeight + searchBarHeight + actionItemsHeight;

    // When searching or showing results
    if (searchTerm.trim().length > 0) {
      if (isSearching) {
        // Show loading state
        return Math.min(baseHeight + 100, maxHeight);
      } else if (filteredResults.length > 0) {
        // Show results with section header
        const resultsHeight = sectionHeaderHeight + (filteredResults.length * itemHeight);
        return Math.min(baseHeight + resultsHeight, maxHeight);
      } else {
        // No results found
        return Math.min(baseHeight + minContentHeight, maxHeight);
      }
    }

    // Default state with empty search - just show base + minimal space
    return Math.min(baseHeight + minContentHeight, maxHeight);
  };

  return (
    <div
      className="flex flex-col bg-white dark:bg-gray-900 border-0 overflow-hidden rounded-lg shadow-xl"
      style={{
        height: `${calculateHeight()}px`,
        minHeight: '360px',
        maxHeight: 'calc(100vh - 6rem)',
        transition: 'height 0.2s ease-out'
      }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">New chat</h2>
      </div>

      {/* Search Bar */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search name or number"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isCreatingConversation}
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

      {/* Error Message */}
      {conversationError && (
        <div className="mx-4 mt-2 mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex-shrink-0">
          <p className="text-xs text-red-800 dark:text-red-200">
            {conversationError}
          </p>
        </div>
      )}

      {/* Fixed Action Items - Always visible at top */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleNewGroup}
          disabled={isCreatingConversation}
          className="w-full flex items-center px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="w-10 h-10 rounded-full bg-green-500 dark:bg-green-600 flex items-center justify-center mr-4 flex-shrink-0">
            <Users size={20} className="text-white" />
          </div>
          <span className="text-[15px] font-normal text-gray-900 dark:text-white">New group</span>
        </button>

        <button
          onClick={handleNewContact}
          disabled={isCreatingConversation}
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
            disabled={isCreatingConversation}
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
                key={user._id}
                onClick={() => handleSelectUser(user)}
                disabled={isCreatingConversation}
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
                    {user.email}
                  </p>
                </div>
                {isCreatingConversation && (
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
    </div>
  );
};

export default NewChatModal;