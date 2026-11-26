/** Explain Node's bare "fetch failed" (network, DNS, TLS or an ignored HTTPS proxy). */
export function describeError(err: unknown, env: NodeJS.ProcessEnv = process.env): string {
  const e = err as Error & { cause?: { message?: string; code?: string } };
  let msg = e?.message || String(err);
  if (msg === 'fetch failed') {
    const cause = e.cause?.code || e.cause?.message;
    msg = `Network request failed${cause ? ` (${cause})` : ''}. Check your connection.`;
    const proxy = env.HTTPS_PROXY || env.https_proxy;
    if (proxy && env.NODE_USE_ENV_PROXY !== '1') {
      msg += '\nHTTPS_PROXY is set but Node ignores it by default. Retry with: NODE_USE_ENV_PROXY=1 saymd …';
    }
  }
  return msg;
}
