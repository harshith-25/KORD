import { useState, useEffect, useRef } from 'react';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useContactsStore } from '@/store/contactsStore';
import { Search, MessageCircle, Users, UserPlus, User, Loader2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const useMediaQuery = (query) => {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const media = window.matchMedia(query);
      if (media.matches !== matches) {
        setMatches(media.matches);
      }
      const listener = () => setMatches(media.matches);
      window.addEventListener("resize", listener);
      return () => window.removeEventListener("resize", listener);
    }
  }, [matches, query]);

  return matches;
};

const NewChatModal = ({ isOpen, onClose, anchorRef }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [startingChat, setStartingChat] = useState(null);
  const modalRef = useRef(null);
  const searchInputRef = useRef(null);
  const isDesktop = useMediaQuery("(min-width: 768px)"); // Media query hook for responsiveness

  // Corrected the import paths
  const { startNewIndividualChat, setSelectedChat } = useChatStore();
  const { user: currentUser } = useAuthStore();
  const { searchUsers, searchResults, setSearchResults } = useContactsStore();

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setLoadingSearch(false);
      setStartingChat(null);
    }
  }, [isOpen, setSearchResults]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target) &&
        anchorRef?.current && !anchorRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (isOpen && isDesktop) { // Only handle click-outside for the popover on desktop
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose, anchorRef, isDesktop]);

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
    console.log('New Group clicked');
    onClose();
  };

  const handleNewContact = () => {
    console.log('New Contact clicked');
    onClose();
  };

  const handleMessageYourself = async () => {
    // Mimic the flow for messaging yourself
    if (startingChat === currentUser._id) return;
    setStartingChat(currentUser._id);

    try {
      const newChatId = await startNewIndividualChat(currentUser);
      if (newChatId) {
        setSelectedChat(newChatId);
        onClose();
      }
    } catch (error) {
      console.error("Error starting 'message yourself' chat:", error);
    } finally {
      setStartingChat(null);
    }
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

  /**
   * This is a reusable render function for the modal content, shared between Popover and Dialog.
   * This design pattern prevents code duplication while accommodating different container components.
   */
  const renderModalContent = () => (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-md">
      {/* Search Command Input */}
      <div className="p-4 border-b border-white/10 dark:border-gray-700/30">
        <Command>
          <CommandInput
            ref={searchInputRef}
            placeholder="Search name or number"
            value={searchTerm}
            onValueChange={setSearchTerm}
            disabled={startingChat !== null}
            className="pl-3 py-2 text-sm bg-gray-100/60 dark:bg-gray-800/60 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:bg-white/80 dark:focus:bg-gray-700/80 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all backdrop-blur-sm"
          />
        </Command>
      </div>

      {/* Quick Actions */}
      <div className="border-b border-white/10 dark:border-gray-700/30 py-2">
        <Button
          onClick={handleNewGroup}
          variant="ghost"
          className="w-full justify-start h-auto px-4 py-3 rounded-none hover:bg-white/40 dark:hover:bg-gray-700/40"
          disabled={startingChat !== null}
        >
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mr-3">
            <Users size={18} className="text-white" />
          </div>
          <span className="text-gray-900 dark:text-white font-medium">New group</span>
        </Button>

        <Button
          onClick={handleNewContact}
          variant="ghost"
          className="w-full justify-start h-auto px-4 py-3 rounded-none hover:bg-white/40 dark:hover:bg-gray-700/40"
          disabled={startingChat !== null}
        >
          <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center mr-3">
            <UserPlus size={18} className="text-white" />
          </div>
          <span className="text-gray-900 dark:text-white font-medium">New contact</span>
        </Button>

        {currentUser && (
          <Button
            onClick={handleMessageYourself}
            variant="ghost"
            className="w-full justify-start h-auto px-4 py-3 rounded-none hover:bg-white/40 dark:hover:bg-gray-700/40"
            disabled={startingChat !== null}
          >
            <Avatar className="w-10 h-10 mr-3">
              <AvatarImage src={getAvatarUrl(currentUser)} alt={getUserDisplayName(currentUser)} />
              <AvatarFallback>{getUserDisplayName(currentUser).charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start">
              <span className="text-gray-900 dark:text-white font-medium">
                {getUserDisplayName(currentUser)} (You)
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Message yourself
              </span>
            </div>
          </Button>
        )}
      </div>

      <Command className="overflow-hidden bg-transparent">
        <CommandList className="flex-1 overflow-y-auto">
          {loadingSearch && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-green-500 mr-2" size={16} />
              <span className="text-sm text-gray-600 dark:text-gray-400">Searching...</span>
            </div>
          )}

          {!loadingSearch && (
            <>
              {searchResults.length > 0 && (
                <CommandGroup heading="Contacts" className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-800/30">
                  {searchResults
                    .filter(user => user._id !== currentUser?._id)
                    .map((user) => (
                      <CommandItem
                        key={user._id}
                        onSelect={() => handleSelectUser(user)}
                        disabled={startingChat === user._id}
                        className="py-2.5 px-4 cursor-pointer aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800"
                      >
                        <Avatar className="w-10 h-10 mr-3">
                          <AvatarImage src={getAvatarUrl(user)} alt={getUserDisplayName(user)} />
                          <AvatarFallback>
                            <span className="text-white font-semibold">{getUserDisplayName(user).charAt(0).toUpperCase()}</span>
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 dark:text-white font-medium truncate text-sm">
                            {getUserDisplayName(user)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {user.email}
                          </p>
                        </div>
                        {startingChat === user._id && (
                          <Loader2 className="animate-spin text-green-500 flex-shrink-0 ml-2" size={14} />
                        )}
                      </CommandItem>
                    ))}
                </CommandGroup>
              )}
              {searchTerm.trim().length > 0 && searchResults.length === 0 && (
                <CommandEmpty className="text-center py-8 px-4">
                  <div className="text-gray-500 dark:text-gray-400">
                    <Search size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No results found for "{searchTerm}"</p>
                    <p className="text-xs mt-1 opacity-75">Try a different search term</p>
                  </div>
                </CommandEmpty>
              )}
              {searchTerm.trim().length === 0 && (
                 <div className="text-center py-8 px-4">
                  <div className="text-gray-500 dark:text-gray-400">
                    <Search size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-sm">Search for contacts to start chatting</p>
                  </div>
                </div>
              )}
            </>
          )}
        </CommandList>
      </Command>
    </div>
  );

  // === Main Render Logic based on screen size ===
  if (isDesktop) {
    return (
      <Popover open={isOpen} onOpenChange={onClose} modal={true}>
        {/* We use an empty PopoverTrigger to control the Popover state with the `isOpen` prop */}
        <PopoverTrigger asChild>
          <div ref={anchorRef} className="absolute inset-0 hidden"></div>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-80 shadow-2xl overflow-hidden rounded-xl border border-white/20 dark:border-gray-700/30"
          align="start"
          sideOffset={8}
          side="right"
          ref={modalRef}
        >
          {renderModalContent()}
        </PopoverContent>
      </Popover>
    );
  }

  // Mobile/Tablet View (using Dialog for full-screen effect)
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="fixed inset-0 p-0 m-0 rounded-none w-full h-full bg-white dark:bg-gray-900 border-none shadow-none">
        {renderModalContent()}
      </DialogContent>
    </Dialog>
  );
};

export default NewChatModal;