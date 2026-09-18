import { useReveal } from '../hooks/useReveal';
import { HealthJson } from './HealthJson';

const OPS = [
	{
		mark: 'health',
		body: 'GET /health is always public and excluded from rate limiting, so Docker and load-balancer probes never need credentials.'
	},
	{
		mark: 'pool',
		body: 'Active, queued and maximum concurrency are reported live, straight from the semaphore.'
	},
	{
		mark: 'limits',
		body: 'Max file size, rate-limit window and conversion timeout travel in the same payload.'
	},
	{
		mark: 'logs',
		body: 'Request-scoped key=value lines go to stdout and stderr. Pipe them anywhere.'
	}
] as const;

export function OperationsSection() {
	const ref = useReveal<HTMLDivElement>();

	return (
		<section className="section" id="operations" aria-labelledby="operations-title">
			<div className="container">
				<header className="section-head">
					<p className="eyebrow">
						<span className="eyebrow__index">05</span> / Operability
					</p>
					<h2 className="section-title" id="operations-title">
						Built to be operated.
					</h2>
					<p className="section-lead">Know what the service is doing without guessing.</p>
				</header>

				<div className="ops__grid" ref={ref}>
					<ul className="ops__list">
						{OPS.map((item) => (
							<li key={item.mark}>
								<b>{item.mark}</b>
								<p>{item.body}</p>
							</li>
						))}
					</ul>

					<HealthJson />
				</div>
			</div>
		</section>
	);
}
