import { MessageCircleHeart } from 'lucide-react';
import { useConversationStore } from '@/store/conversationStore';
import { IconCloud } from "@/components/ui/icon-cloud"

const slugs = [
	"react",
	"nodedotjs",
	"express",
	"socketdotio",
	"redis",
	"postgresql",
	"mongodb",
	"typescript",
	"javascript",
	"html5",
	"shadcnui",
	"tailwindCSS",
	"docker",
	"amazonwebservices",
	"betterauth",
	"git",
	"github",
	"jsonwebtokens",
	"vite",
];

export function IconCloudDemo() {
	const { contacts } = useConversationStore();
	const images = slugs.map(
		(slug) => `https://cdn.simpleicons.org/${slug}/${slug}`
	);

	const COLORS = [
		"ff6b6b", "feca57", "48dbfb", "1dd1a1", "5f27cd",
		"ff9ff3", "00d2d3", "54a0ff", "ff9f43", "10ac84"
	];

	// helper for stable color generation
	function getRandomColor(seed = "") {
		let h = 0;
		for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
		return COLORS[Math.abs(h) % COLORS.length];
	}

	function fixAvatarUrl(url, seed = "user") {
		if (!url) return url;

		// check if it's a dicebear URL
		if (url.includes("api.dicebear.com")) {
			const randomColor = getRandomColor(seed);
			// replace backgroundColor=random with a valid color
			return url.replace(/backgroundColor=random/gi, `backgroundColor=${randomColor}`);
		}

		// return unchanged for all other URLs
		return url;
	}

	// usage
	const avatars = contacts.slice(0, 20).map((contact) =>
		fixAvatarUrl(contact.avatar, contact.firstName || contact.username || "user")
	);

	return (
		<div className="relative flex size-full items-center justify-center overflow-hidden">
			<IconCloud images={contacts.length > 10 ? avatars : images} />
		</div>
	)
}

function NoChatSelectedPlaceholder() {
	return (
		<div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900">
			{/* <MessageCircleHeart className="w-24 h-24 sm:w-32 sm:h-32 mb-6 text-gray-400 dark:text-gray-600" strokeWidth={1} /> */}
			<IconCloudDemo />
			<h2 className="text-2xl sm:text-3xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
				Kord for Web
			</h2>
			<p className="max-w-sm text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
				Send and receive messages without keeping your phone online.
				Use Kord on up to 4 linked devices and 1 phone at the same time.
			</p>
			<div className="mt-8 text-xs sm:text-sm">
				<span className="inline-flex items-center text-gray-500 dark:text-gray-500">
					<MessageCircleHeart className="h-4 w-4 mr-1" />
					End-to-end encrypted
				</span>
			</div>
		</div>
	);
}


function SignInPlaceholder() {
	return (
		<div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900">
			<MessageCircleHeart className="w-24 h-24 sm:w-32 sm:h-32 mb-6 text-gray-400 dark:text-gray-600" strokeWidth={1} />
			<h2 className="text-2xl sm:text-3xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
				Please sign in
			</h2>
			<p className="max-w-sm text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
				You need to be signed in to access your messages.
			</p>
		</div>
	);
}


const renderSkeleton = () => (
	<div className="divide-y divide-gray-100 dark:divide-gray-700">
		{Array.from({ length: 7 }).map((_, i) => (
			<div key={i} className="flex items-center p-3 animate-pulse">
				<div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full mr-3"></div>
				<div className="flex-1">
					<div className="flex justify-between items-start mb-1">
						<div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
						<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
					</div>
					<div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
				</div>
			</div>
		))}
	</div>
);

function GroupsIcon() {
	return (
		<svg fill="var(--colorNeutralForeground1)" class="___12fm75w f1w7gpdv fez10in fg4l7m0" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14.75 10c.97 0 1.75.78 1.75 1.75v4.75a4.5 4.5 0 0 1-9 0v-4.75c0-.97.79-1.75 1.75-1.75h5.5Zm0 1.5h-5.5a.25.25 0 0 0-.25.25v4.75a3 3 0 0 0 6 0v-4.75a.25.25 0 0 0-.25-.25Zm-11-1.5h3.38c-.34.41-.57.93-.62 1.5H3.75a.25.25 0 0 0-.25.25V15a2.5 2.5 0 0 0 3.08 2.43c.09.5.24.99.45 1.43A4 4 0 0 1 2 15v-3.24c0-.97.78-1.75 1.75-1.75Zm13.12 0h3.38c.97 0 1.75.78 1.75 1.75V15a4 4 0 0 1-5.03 3.87c.21-.45.37-.93.46-1.44A2.5 2.5 0 0 0 20.5 15v-3.25a.25.25 0 0 0-.25-.25h-2.76a2.74 2.74 0 0 0-.62-1.5ZM12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm6.5 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm-13 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm6.5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6.5 1a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-13 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" fill="var(--colorNeutralForeground1)"></path></svg>
	)
}

export { SignInPlaceholder, NoChatSelectedPlaceholder, renderSkeleton, GroupsIcon };