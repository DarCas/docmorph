interface BrandMarkProps {
	className?: string;
	size?: number;
}

export function BrandMark({ className, size = 26 }: BrandMarkProps) {
	return (
		<svg
			className={className}
			width={size}
			height={size}
			viewBox="0 0 32 32"
			role="img"
			aria-hidden="true"
			focusable="false"
		>
			<rect x="1" y="1" width="30" height="30" rx="3" fill="none" stroke="var(--rule-strong)" />
			<path
				d="M8 5h9l6 6v16H8z"
				fill="none"
				stroke="var(--text)"
				strokeWidth="1.4"
				strokeLinejoin="round"
			/>
			<path d="M17 5v6h6" fill="none" stroke="var(--text)" strokeWidth="1.4" strokeLinejoin="round" />
			<path
				d="M11 19h7m0 0-2.6-2.6M18 19l-2.6 2.6"
				fill="none"
				stroke="var(--accent)"
				strokeWidth="1.6"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}
