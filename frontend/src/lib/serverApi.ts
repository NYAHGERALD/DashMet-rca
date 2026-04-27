export function getServerApiBaseUrl() {
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (publicApiUrl && !publicApiUrl.startsWith('/')) {
    return publicApiUrl.replace(/\/+$/, '');
  }

  const proxyTarget = process.env.API_PROXY_TARGET || '';
  if (proxyTarget) {
    const normalizedProxyTarget = proxyTarget
      .replace(/\/api\/?$/, '')
      .replace(/\/+$/, '');
    return `${normalizedProxyTarget}/api`;
  }

  return 'http://localhost:5001/api';
}
