type Depth = 0 | 1 | 2;

interface RowProps {
	depth?: Depth;
	keyName: string;
	value: string;
	valueClass?: string;
	comma?: boolean;
}

const indentClass = (depth: Depth) => {
	if (depth === 2) return 'health-json__indent-2';
	if (depth === 1) return 'health-json__indent';
	return '';
};

function Row({ depth = 0, keyName, value, valueClass, comma }: RowProps) {
	const indent = indentClass(depth);
	return (
		<div className={['health-json__row', indent].filter(Boolean).join(' ')}>
			<span className="health-json__key">"{keyName}":</span>
			<span>
				<span className={['health-json__val', valueClass].filter(Boolean).join(' ')}>{value}</span>
				{comma ? ',' : ''}
			</span>
		</div>
	);
}

function Brace({ depth = 0, text }: { depth?: Depth; text: string }) {
	const indent = indentClass(depth);
	return (
		<div className={['health-json__row', indent].filter(Boolean).join(' ')}>
			<span className="health-json__brace">{text}</span>
		</div>
	);
}

export function HealthJson() {
	return (
		<div className="health-json">
			<div className="health-json__head">
				<span>GET /health · 200</span>
				<span className="machine__status">
					<span className="machine__dot" /> public
				</span>
			</div>
			<div className="health-json__body" aria-label="Example /health response">
				<Brace text="{" />
				<Row depth={1} keyName="status" value='"ok"' valueClass="is-ok" comma />
				<Row depth={1} keyName="authEnabled" value="true" valueClass="is-accent" comma />
				<Row depth={1} keyName="concurrency" value="{" valueClass="health-json__brace" />
				<Row depth={2} keyName="active" value="0" comma />
				<Row depth={2} keyName="queued" value="0" comma />
				<Row depth={2} keyName="max" value="3" />
				<Brace depth={1} text="}," />
				<Row depth={1} keyName="maxFileSize" value="10485760" comma />
				<Row depth={1} keyName="rateLimit" value="{" valueClass="health-json__brace" />
				<Row depth={2} keyName="max" value="60" comma />
				<Row depth={2} keyName="windowMs" value="60000" />
				<Brace depth={1} text="}," />
				<Row depth={1} keyName="timeoutMs" value="60000" />
				<Brace text="}" />
			</div>
		</div>
	);
}
