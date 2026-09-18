import { CodeBlock } from '../components/CodeBlock';
import { DocRail } from '../components/DocRail';
import { useReveal } from '../hooks/useReveal';

const STEPS = [
	{
		title: 'Pull the image',
		body: 'ghcr.io/darcas/docmorph:latest is public. No build step, no toolchain, no fonts to install.'
	},
	{
		title: 'Set a key — optional',
		body: 'Pass API_KEYS to require x-api-key or Authorization: Bearer on every route except /health. Leave it unset for open access.'
	},
	{
		title: 'Publish a port',
		body: 'Map container port 8080 wherever your infrastructure expects it.'
	},
	{
		title: 'Point your backend at it',
		body: 'POST a .docx to /convert and stream the PDF back. That is the whole integration.'
	}
] as const;

export function DeploymentSection() {
	const ref = useReveal<HTMLDivElement>();

	return (
		<section className="section" id="deploy" aria-labelledby="deploy-title">
			<div className="container">
				<header className="section-head">
					<p className="eyebrow">
						<span className="eyebrow__index">06</span> / Self-host it
					</p>
					<h2 className="section-title" id="deploy-title">
						One container. Your infrastructure.
					</h2>
					<p className="section-lead">Your documents stay inside your network. The service stays out of your way.</p>
				</header>

				<div className="deploy__grid" ref={ref}>
					<ol className="deploy__steps">
						{STEPS.map((step) => (
							<li key={step.title}>
								<h3>{step.title}</h3>
								<p>{step.body}</p>
							</li>
						))}
					</ol>

					<div className="deploy__stack">
						<CodeBlock id="docker-run" caption="docker run" />
						<CodeBlock id="docker-compose" caption="docker-compose.yml" />
					</div>
				</div>

				<div className="transform__foot">
					<DocRail from="your host" label="[ docker ]" to="your network" />
				</div>
			</div>
		</section>
	);
}
