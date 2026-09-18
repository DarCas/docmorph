import { useReveal } from '../hooks/useReveal';

const GUARDS = [
	{
		title: 'Extension check',
		body: 'Only .docx is accepted. Anything else is rejected up front.',
		code: 'endsWith(".docx")'
	},
	{
		title: 'OOXML magic bytes',
		body: 'The ZIP/OOXML signature is verified — not just the file name.',
		code: 'PK\\x03\\x04'
	},
	{
		title: 'Size limit',
		body: 'Uploads are capped before they reach the converter.',
		code: 'MAX_FILE_SIZE'
	},
	{
		title: 'PDF output assert',
		body: 'The generated file must start with the PDF header before it is streamed.',
		code: '%PDF'
	},
	{
		title: 'Optional API key',
		body: 'When API_KEYS is set, every route except /health requires a key.',
		code: 'x-api-key'
	},
	{
		title: 'Per-IP rate limit',
		body: 'A fixed window per client IP. /health is excluded so probes stay cheap.',
		code: '60 / min'
	},
	{
		title: 'Conversion timeout',
		body: 'A stalled LibreOffice process is killed instead of holding a slot forever.',
		code: 'CONVERT_TIMEOUT_MS'
	}
] as const;

const SPECS = [
	{ value: '10 MiB', label: 'max input' },
	{ value: '60 s', label: 'conversion timeout' },
	{ value: '3', label: 'concurrent jobs' },
	{ value: '60 / min', label: 'requests per IP' }
] as const;

export function Guardrails() {
	const ref = useReveal<HTMLDivElement>();

	return (
		<section className="section section--guard" id="guardrails" aria-labelledby="guardrails-title">
			<div className="container">
				<header className="section-head">
					<p className="eyebrow">
						<span className="eyebrow__index">03</span> / Guardrails
					</p>
					<h2 className="section-title" id="guardrails-title">
						Small API. Serious guardrails.
					</h2>
					<p className="section-lead">
						Every request is checked, bounded and timed. Failures are explicit, never silent.
					</p>
				</header>

				<div className="guard__grid" ref={ref}>
					<div className="guard__list">
						{GUARDS.map((guard) => (
							<div className="guard__item" key={guard.title}>
								<span className="guard__check" aria-hidden="true">
									✓
								</span>
								<div>
									<h3>{guard.title}</h3>
									<p>{guard.body}</p>
								</div>
								<code className="guard__code">{guard.code}</code>
							</div>
						))}
					</div>

					<div>
						<div className="spec-strip">
							{SPECS.map((spec) => (
								<div className="spec" key={spec.label}>
									<div className="spec__value">{spec.value}</div>
									<div className="spec__label">{spec.label}</div>
								</div>
							))}
						</div>
						<p className="guard__aside-note">
							Defaults shown. Every value is an environment variable — override it on the command line or
							in your compose file.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
