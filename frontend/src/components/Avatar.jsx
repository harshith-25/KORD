import { Avatar as ShadcnAvatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getInitials } from '@/utils/helpers';

/**
 * Reusable Avatar Component
 * @param {Object} props
 * @param {string} props.src - Avatar image URL
 * @param {string} props.name - User/Chat name for fallback initials
 * @param {string} props.id - Unique ID for consistent color generation
 * @param {string} props.size - Size variant: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
 * @param {boolean} props.showOnline - Whether to show online indicator
 * @param {boolean} props.isOnline - Online status
 * @param {string} props.className - Additional CSS classes
 */
function Avatar({
	src,
	name = '',
	id = '',
	size = 'md',
	showOnline = false,
	isOnline = false,
	className = ''
}) {
	// Size mappings
	const sizeClasses = {
		xs: 'w-8 h-8 text-xs',
		sm: 'w-10 h-10 text-sm',
		md: 'w-12 h-12 text-base',
		lg: 'w-14 h-14 text-lg',
		xl: 'w-16 h-16 text-xl'
	};

	// Online indicator size mappings
	const onlineIndicatorSizes = {
		xs: 'w-2 h-2 border',
		sm: 'w-2.5 h-2.5 border-2',
		md: 'w-3 h-3 border-2',
		lg: 'w-3.5 h-3.5 border-2',
		xl: 'w-4 h-4 border-2'
	};

	const avatarSize = sizeClasses[size] || sizeClasses.md;
	const indicatorSize = onlineIndicatorSizes[size] || onlineIndicatorSizes.md;

	// Generate colorful gradient based on ID or name
	const getColorfulGradient = (identifier) => {
		const gradients = [
			'from-rose-400 via-pink-500 to-purple-600',
			'from-blue-400 via-cyan-500 to-teal-600',
			'from-green-400 via-emerald-500 to-teal-600',
			'from-yellow-400 via-orange-500 to-red-600',
			'from-red-400 via-rose-500 to-pink-600',
			'from-pink-400 via-fuchsia-500 to-purple-600',
			'from-indigo-400 via-purple-500 to-pink-600',
			'from-teal-400 via-cyan-500 to-blue-600',
			'from-lime-400 via-green-500 to-emerald-600',
			'from-amber-400 via-orange-500 to-red-600',
			'from-violet-400 via-purple-500 to-indigo-600',
			'from-sky-400 via-blue-500 to-indigo-600',
			'from-emerald-400 via-teal-500 to-cyan-600',
			'from-fuchsia-400 via-pink-500 to-rose-600',
			'from-orange-400 via-red-500 to-pink-600',
			'from-cyan-400 via-blue-500 to-purple-600',
		];

		let hash = 0;
		const str = String(identifier || name || 'default');
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0xffffffff;
		}

		return gradients[Math.abs(hash) % gradients.length];
	};

	const gradient = getColorfulGradient(id || name);

	// Generate fallback avatar URL using DiceBear
	const fallbackAvatarUrl = `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=random&radius=50`;

	return (
		<div className={`relative inline-block ${className}`}>
			<ShadcnAvatar className={`${avatarSize} flex-shrink-0`}>
				<AvatarImage
					src={src || fallbackAvatarUrl}
					alt={name}
					className="object-cover"
				/>
				<AvatarFallback
					className={`bg-gradient-to-br ${gradient} text-white font-semibold`}
				>
					{getInitials(name)}
				</AvatarFallback>
			</ShadcnAvatar>

			{/* Online indicator */}
			{showOnline && isOnline && (
				<div
					className={`absolute bottom-0 right-0 ${indicatorSize} bg-green-500 border-white dark:border-gray-800 rounded-full`}
				/>
			)}
		</div>
	);
}

export default Avatar;