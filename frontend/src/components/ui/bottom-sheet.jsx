import { Drawer } from 'vaul';
import { X } from 'lucide-react';

/**
 * BottomSheet - Reusable bottom sheet component using vaul
 * @param {Object} props
 * @param {boolean} props.open - Whether the bottom sheet is open
 * @param {function} props.onOpenChange - Callback when open state changes
 * @param {React.ReactNode} props.children - Content to display in the sheet
 * @param {string} props.title - Optional title for the sheet
 * @param {string} props.description - Optional description
 * @param {string} props.snapPoint - Snap point: 'auto', 'half', 'full' (default: 'auto')
 * @param {boolean} props.dismissible - Whether sheet can be dismissed (default: true)
 * @param {boolean} props.showHandle - Whether to show drag handle (default: true)
 */
export function BottomSheet({
	open,
	onOpenChange,
	children,
	title,
	description,
	snapPoint = 'auto',
	dismissible = true,
	showHandle = true,
}) {
	const snapPoints = {
		auto: 'fit-content',
		half: '50vh',
		full: '95vh',
	};

	return (
		<Drawer.Root
			open={open}
			onOpenChange={onOpenChange}
			dismissible={dismissible}
		>
			<Drawer.Portal>
				<Drawer.Overlay className="fixed inset-0 bg-black/40 z-50" />
				<Drawer.Content
					className="fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-white dark:bg-gray-900 rounded-t-[10px] outline-none"
					style={{
						maxHeight: snapPoints[snapPoint] || snapPoints.auto,
					}}
				>
					{/* Drag Handle */}
					{showHandle && (
						<div className="flex justify-center py-3 border-b border-gray-200 dark:border-gray-700">
							<div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
						</div>
					)}

					{/* Header */}
					{(title || description) && (
						<div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
							<div className="flex items-center justify-between">
								<div className="flex-1">
									{title && (
										<Drawer.Title className="text-lg font-semibold text-gray-900 dark:text-white">
											{title}
										</Drawer.Title>
									)}
									{description && (
										<Drawer.Description className="text-sm text-gray-500 dark:text-gray-400 mt-1">
											{description}
										</Drawer.Description>
									)}
								</div>
								{dismissible && (
									<button
										onClick={() => onOpenChange(false)}
										className="p-2 -mr-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
										aria-label="Close"
									>
										<X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
									</button>
								)}
							</div>
						</div>
					)}

					{/* Content */}
					<div className="flex-1 overflow-y-auto">
						{children}
					</div>
				</Drawer.Content>
			</Drawer.Portal>
		</Drawer.Root>
	);
}

// Export individual components for advanced usage
export const BottomSheetTrigger = Drawer.Trigger;
export const BottomSheetClose = Drawer.Close;
export const BottomSheetPortal = Drawer.Portal;
export const BottomSheetOverlay = Drawer.Overlay;
export const BottomSheetContent = Drawer.Content;
export const BottomSheetTitle = Drawer.Title;
export const BottomSheetDescription = Drawer.Description;

export default BottomSheet;