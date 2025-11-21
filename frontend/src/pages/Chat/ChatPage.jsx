import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ChatMainPanel from '@/pages/Chat/ChatMainPanel';
import { useChatStore } from '@/store/chatStore';

const ChatPage = () => {
	const { chatId } = useParams();
	const { setSelectedChat, selectedChatId } = useChatStore();

	useEffect(() => {
		// If a chatId is present in the URL, set it as the selected chat
		if (chatId) {
			if (chatId !== selectedChatId) {
				setSelectedChat(chatId);
			}
		} else {
			// No chatId in URL – ensure no chat is selected by default
			if (selectedChatId !== null) {
				setSelectedChat(null);
			}
		}
		// User must explicitly select a chat when navigating
	}, [chatId, setSelectedChat, selectedChatId]);

	// ChatMainPanel will render the empty state if no chat is selected,
	// or the actual chat view if selectedChatId is set by the useEffect.
	return <ChatMainPanel />;
};

export default ChatPage;