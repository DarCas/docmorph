interface DocRailProps {
	from?: string;
	to?: string;
	label?: string;
	className?: string;
}

export function DocRail({ from = '.DOCX', to = '.PDF', label = '[ MORPH ]', className }: DocRailProps) {
	return (
		<div className={['rail', className].filter(Boolean).join(' ')} aria-hidden="true">
			<span className="rail__frag">{from}</span>
			<span className="rail__line" />
			<span className="rail__frag rail__frag--hot">{label}</span>
			<span className="rail__line" />
			<span className="rail__frag">{to}</span>
		</div>
	);
}
