import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS, SETTINGS_ENTRIES } from '@/components/GlobalSidebar';

const Section = ({ title, items, onSelect }) => {
	if (!items?.length) return null;
	return (
		<div className="mb-6">
			<p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3 px-1">{title}</p>
			<div className="grid grid-cols-3 gap-3">
				{items.map((item) => {
					const Icon = item.icon;
					return (
						<button
							key={item.name}
							onClick={() => onSelect(item)}
							className="flex flex-col items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-3 text-gray-700 dark:text-gray-200 active:scale-[0.98] transition-transform"
						>
							<div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
								<Icon className="h-5 w-5" strokeWidth={1.8} />
							</div>
							<span className="text-xs font-medium text-center">{item.name}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
};

const MobileNavSheet = memo(({ open, onOpenChange, onOpenSettings }) => {
	const navigate = useNavigate();

	const sections = useMemo(() => {
		const handleSettings = (tab) => onOpenSettings?.(tab);
		return [
			{
				title: 'Main',
				items: PRIMARY_NAV_ITEMS.map(item => ({ ...item, type: 'route' })),
			},
			{
				title: 'More',
				items: [
					...SECONDARY_NAV_ITEMS.map(item => ({ ...item, type: 'route' })),
					...SETTINGS_ENTRIES(null, handleSettings).map(item => ({ ...item, type: 'action' })),
				],
			},
		];
	}, [onOpenSettings]);

	const handleSelect = (item) => {
		if (item.type === 'route' && item.path) {
			navigate(item.path);
			onOpenChange(false);
			return;
		}
		if (item.action) {
			item.action();
			onOpenChange(false);
		}
	};

	return (
		<BottomSheet
			open={open}
			onOpenChange={onOpenChange}
			snapPoint="half"
			title="Quick actions"
			description="Navigate anywhere in Kord"
		>
			<div className="p-4 pb-6">
				{sections.map((section) => (
					<Section key={section.title} title={section.title} items={section.items} onSelect={handleSelect} />
				))}
			</div>
		</BottomSheet>
	);
});

MobileNavSheet.displayName = 'MobileNavSheet';

export default MobileNavSheet;

