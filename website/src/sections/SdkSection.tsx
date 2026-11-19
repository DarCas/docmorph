import { CodeBlock } from '../components/CodeBlock';
import { useReveal } from '../hooks/useReveal';

const NPM_URL = 'https://www.npmjs.com/package/@darcas/docmorph-sdk';
const SDK_README_URL = 'https://github.com/DarCas/docmorph/tree/master/sdk';

const CAPABILITIES = [
	{
		mark: 'typed errors',
		body: 'Every failure is a DocMorphError with a stable code, so you branch on INVALID_CONTENT or RATE_LIMITED instead of parsing messages.'
	},
	{
		mark: 'retries',
		body: 'Opt-in retries for 429, 502–504 and network failures, with exponential backoff. Retry-After wins when the server sends it.'
	},
	{
		mark: 'cancel',
		body: 'A per-call timeout override and AbortSignal cancellation. The default 120 s per attempt covers queueing plus the service timeout.'
	},
	{
		mark: 'bound',
		body: 'health and convert are bound to the instance, so destructuring them or passing them as callbacks needs no wrapper.'
	},
	{
		mark: 'portable',
		body: 'Zero runtime dependencies, ESM + CJS builds and bundled declarations. convertFile reads from disk; the core also runs in the browser.'
	}
] as const;

export function SdkSection() {
	const ref = useReveal<HTMLDivElement>();

	return (
		<section className="section" id="sdk" aria-labelledby="sdk-title">
			<div className="container">
				<header className="section-head">
					<p className="eyebrow">
						<span className="eyebrow__index">05</span> / SDK
					</p>
					<h2 className="section-title" id="sdk-title">
						A typed client, same endpoint.
					</h2>
					<p className="section-lead">
						If you would rather not hand-roll multipart uploads, the SDK wraps the same two routes
						with typed results, typed errors, retries and cancellation. Zero runtime dependencies.
					</p>
				</header>

				<div className="sdk__grid" ref={ref}>
					<div className="sdk__stack">
						<CodeBlock id="sdk-install" caption="install" />
						<CodeBlock id="sdk-convert" caption="convert-file.ts" />
					</div>

					<div>
						<ul className="sdk__list">
							{CAPABILITIES.map((item) => (
								<li key={item.mark}>
									<b>{item.mark}</b>
									<p>{item.body}</p>
								</li>
							))}
						</ul>

						<div className="btn-row sdk__links">
							<a className="btn" href={NPM_URL} target="_blank" rel="noreferrer noopener">
								npm package <span className="btn__arrow">↗</span>
							</a>
							<a
								className="btn btn--quiet"
								href={SDK_README_URL}
								target="_blank"
								rel="noreferrer noopener"
							>
								SDK README <span className="btn__arrow">↗</span>
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
