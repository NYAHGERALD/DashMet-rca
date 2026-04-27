import ReactMarkdown from 'react-markdown';
import { PolicyModalShell } from '../../components/policies/PolicyModalShell';
import { getServerApiBaseUrl } from '@/lib/serverApi';

async function getPolicy() {
  const baseUrl = getServerApiBaseUrl();
  const res = await fetch(`${baseUrl}/policies/privacy-policy`, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data?.policy ?? null;
}

export default async function PrivacyPolicyPage() {
  const policy = await getPolicy();

  return (
    <PolicyModalShell title="Privacy Policy" publishedAt={policy?.publishedAt ?? null}>
      {policy?.content ? <ReactMarkdown>{policy.content}</ReactMarkdown> : <p>Policy content is unavailable.</p>}
    </PolicyModalShell>
  );
}
