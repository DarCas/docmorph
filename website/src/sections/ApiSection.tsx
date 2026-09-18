import { CodeTabs } from '../components/CodeTabs';
import { useReveal } from '../hooks/useReveal';

const TABS = [
	{ id: 'curl-convert', label: 'cURL', caption: 'curl' },
	{ id: 'typescript-convert', label: 'TypeScript', caption: 'native fetch' },
	{ id: 'python-convert', label: 'Python', caption: 'requests' }
] as const;

const ERRORS = [
	{ status: '401', meaning: 'Missing or invalid API key' },
	{ status: '412', meaning: 'Missing file field or unsupported extension' },
	{ status: '415', meaning: 'File content is not a valid .docx (magic-byte check)' },
	{ status: '429', meaning: 'Rate limit exceeded (Retry-After + RateLimit-* headers)' },
	{ status: '500', meaning: 'Conversion failed' }
] as const;

export function ApiSection() {
	const ref = useReveal<HTMLDivElement>();

	return (
		<section className="section section--api" id="api" aria-labelledby="api-title">
			<div className="container">
				<header className="section-head">
					<p className="eyebrow">
						<span className="eyebrow__index">04</span> / API in action
					</p>
					<h2 className="section-title" id="api-title">
						The API is intentionally boring.
					</h2>
					<p className="section-lead">
						If you can POST a file, you can use DocMorph. One multipart field, one PDF back.
					</p>
				</header>

				<div className="api__grid" ref={ref}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
						<div className="endpoint">
							<span className="endpoint__method">POST</span>
							<span className="endpoint__path">/convert</span>
							<span className="endpoint__desc">field: file</span>
						</div>
						<CodeTabs tabs={TABS} label="Convert a document" />
					</div>

					<div>
						<div className="endpoint">
							<span className="endpoint__method">GET</span>
							<span className="endpoint__path">/health</span>
							<span className="endpoint__desc">public probe</span>
						</div>

						<div className="table-wrap">
							<table>
								<caption className="sr-only">POST /convert error responses</caption>
								<thead>
									<tr>
										<th scope="col">Status</th>
										<th scope="col">What it means</th>
									</tr>
								</thead>
								<tbody>
									{ERRORS.map((error) => (
										<tr key={error.status}>
											<td>
												<span className="status-code">{error.status}</span>
											</td>
											<td>{error.meaning}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<p className="guard__aside-note">
							Successful responses carry <code>Content-Type: application/pdf</code> and an inline
							filename sanitized to <code>[A-Za-z0-9._-]</code>.
						</p>
					</div>
				</div>
			</div>
		</section>
	);
}
