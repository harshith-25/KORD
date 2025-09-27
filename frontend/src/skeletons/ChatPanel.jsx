import { MessageCircleHeart } from 'lucide-react';

function NoChatSelectedPlaceholder() {
	return (
		<div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900">
			<MessageCircleHeart className="w-24 h-24 sm:w-32 sm:h-32 mb-6 text-gray-400 dark:text-gray-600" strokeWidth={1} />
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

export { SignInPlaceholder, NoChatSelectedPlaceholder, renderSkeleton };