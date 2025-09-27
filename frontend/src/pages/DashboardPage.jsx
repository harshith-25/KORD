import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/store/chatStore';
import ChatMainPanel from '@/pages/Chat/ChatMainPanel'; // Import the main chat panel

const DashboardPage = () => {
	const navigate = useNavigate();
	const selectedChatId = useChatStore((state) => state.selectedChatId);

	// If a chat is already selected, redirect to the chat page directly
	useEffect(() => {
		if (selectedChatId) {
			navigate(`/chat/${selectedChatId}`, { replace: true });
		} else {
			// Optionally, if you want the dashboard to *always* be a starting point
			// before selecting a chat, you can remove the navigate and keep ChatMainPanel
			// If no chat is selected, it will show the empty state.
		}
	}, [selectedChatId, navigate]);

	// Render the empty chat panel state or whatever default dashboard content you want
	return <ChatMainPanel />;
};

export default DashboardPage;