import { useReveal } from '../hooks/useReveal';

const NOTES = [
	{
		mark: '—',
		title: 'No database',
		body: 'Nothing to migrate, back up, or keep in sync. State lives in the request and ends with the response.'
	},
	{
		mark: '—',
		title: 'No job history',
		body: 'The request is the job. Success or failure, it is over as soon as the HTTP response is written.'
	},
	{
		mark: '—',
		title: 'No accounts',
		body: 'Optional API keys from a comma-separated environment variable. That is the entire user model.'
	},
	{
		mark: '—',
		title: 'No dashboard',
		body: 'One public /health endpoint reports pool load, limits and auth. Operate it with the tools you already have.'
	}
] as const;

export function SmallByDesign() {
	const ref = useReveal<HTMLDivElement>();

	return (
		<section className="section" id="design" aria-labelledby="design-title">
			<div className="container">
				<header className="section-head">
					<p className="eyebrow">
						<span className="eyebrow__index">02</span> / Small by design
					</p>
					<h2 className="section-title" id="design-title">
						DocMorph does less. On purpose.
					</h2>
				</header>

				<div className="small__grid" ref={ref}>
					<p className="small__statement">
						A small surface is easier to trust. Every feature DocMorph does not have is{' '}
						<em>a thing that cannot break</em>.
					</p>

					<div className="small__notes">
						{NOTES.map((note) => (
							<article className="note" key={note.title}>
								<span className="note__mark" aria-hidden="true">
									{note.mark}
								</span>
								<div>
									<h3>{note.title}</h3>
									<p>{note.body}</p>
								</div>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
