import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ChatMainPanel from '@/pages/Chat/ChatMainPanel';
import { useChatStore } from '@/store/chatStore';

const ChatPage = () => {
	const { chatId } = useParams();
	const navigate = useNavigate();
	const { setSelectedChat, contacts, selectedChatId } = useChatStore();

	useEffect(() => {
		// If a chatId is in the URL, set it as the selected chat in the store
		if (chatId && chatId !== selectedChatId) {
			setSelectedChat(chatId);
		} else if (!chatId && selectedChatId) {
			// If no chatId in URL but one is selected in store, navigate to it
			navigate(`/chat/${selectedChatId}`, { replace: true });
		}
		// Removed automatic selection of first conversation - user must explicitly click
	}, [chatId, setSelectedChat, selectedChatId, navigate]);

	// ChatMainPanel will render the empty state if no chat is selected,
	// or the actual chat view if selectedChatId is set by the useEffect.
	return <ChatMainPanel />;
};

export default ChatPage;