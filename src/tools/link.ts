// inspect_link: static checks on a URL, then a guarded redirect follow and an RDAP domain-age lookup.
// The redirect follower never reads response bodies and refuses private/reserved addresses (SSRF guard).

import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { signal, type Signal, type ToolResult } from '../evidence.ts';
import { OFFICIAL_DOMAINS } from './official.ts';

const MAX_REDIRECTS = 5;
const HOP_TIMEOUT_MS = 4000;
const TOTAL_DEADLINE_MS = 10000;
const RDAP_TIMEOUT_MS = 5000;
const NEW_DOMAIN_DAYS = 30;
const ALLOWED_PORTS = new Set(['', '80', '443']);
const SHORTENERS = new Set(['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'shorturl.at', 'is.gd', 'rb.gy', 's.id', 'wa.link']);
// Second-level suffixes where the registrable domain is three labels (example.com.my).
const TWO_LEVEL_SUFFIXES = new Set(['com.my', 'gov.my', 'org.my', 'net.my', 'edu.my', 'name.my', 'co.uk', 'com.sg']);

const blocked = new BlockList();
for (const [net, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blocked.addSubnet(net, prefix, 'ipv4');
for (const [net, prefix] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['100::', 64], ['2001:db8::', 32], ['2002::', 16],
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(net, prefix, 'ipv6');

export function isBlockedAddress(address: string): boolean {
  const mappedV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mappedV4) return blocked.check(mappedV4[1], 'ipv4');
  const family = isIP(address);
  if (family === 0) return true;
  return blocked.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

/** DNS lookup that fails if any resolved address is private or reserved, so the socket can never reach one. */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, '', 0);
    if (addresses.length === 0 || addresses.some((a) => isBlockedAddress(a.address))) {
      return callback(Object.assign(new Error('blocked address'), { code: 'EBLOCKED' }), '', 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

export function registrableDomain(host: string): string {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.');
  const lastTwo = labels.slice(-2).join('.');
  return TWO_LEVEL_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo;
}

/** Checks that need no network: lookalikes, punycode, raw IPs, credential tricks, APK downloads. */
export function staticLinkSignals(url: URL): Signal[] {
  const signals: Signal[] = [];
  const host = url.hostname.toLowerCase();
  const domain = registrableDomain(host);

  if (url.username || url.password) {
    signals.push(signal('link_userinfo_trick', 'high', 'The link hides its real address after an "@" sign.'));
  }
  if (isIP(host.replace(/^\[|\]$/g, ''))) {
    signals.push(signal('link_raw_ip', 'medium', 'The link uses a bare IP address instead of a website name.'));
  }
  if (host.split('.').some((label) => label.startsWith('xn--'))) {
    signals.push(signal('link_punycode', 'high', 'The website name uses look-alike characters (punycode).'));
  }
  if (/\.apk($|\?)/i.test(url.pathname)) {
    signals.push(signal('link_apk_download', 'high', 'The link downloads an Android app (APK) outside the Play Store.'));
  }
  if (SHORTENERS.has(domain)) {
    signals.push(signal('link_shortener', 'info', 'The link uses a URL shortener that hides the real destination.'));
  }
  if (url.protocol === 'http:') {
    signals.push(signal('link_no_https', 'info', 'The link is not encrypted (http, not https).'));
  }

  const official = OFFICIAL_DOMAINS.find((o) => o.domains.includes(domain));
  if (!official) {
    const imitated = OFFICIAL_DOMAINS.find((o) => o.keywords.some((k) => host.replace(/[-.]/g, '').includes(k)));
    if (imitated) {
      signals.push(signal(
        'link_lookalike',
        'high',
        `The website mentions ${imitated.name} but is not its official site (${imitated.domains[0]}).`,
      ));
    }
  }
  return signals;
}

interface HopResult {
  status: number;
  location: string | null;
}

function requestHead(url: URL, timeoutMs: number): Promise<HopResult> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(url, { method: 'GET', lookup: guardedLookup, timeout: timeoutMs, headers: { 'user-agent': 'AwasScanAgent/0.1 (scam checker)' } }, (res) => {
      // Status and headers are all we need; destroy so the body is never read.
      resolve({ status: res.statusCode ?? 0, location: res.headers.location ?? null });
      res.destroy();
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })));
    req.on('error', reject);
    req.end();
  });
}

/** Follows redirects hop by hop, re-checking every hop's scheme, port and address. */
export async function followRedirects(start: URL, request = requestHead): Promise<{ hops: string[]; finalStatus: number | null; stoppedBecause: string | null }> {
  const deadline = Date.now() + TOTAL_DEADLINE_MS;
  const hops: string[] = [start.hostname];
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!['http:', 'https:'].includes(current.protocol) || !ALLOWED_PORTS.has(current.port)) {
      return { hops, finalStatus: null, stoppedBecause: 'unsupported scheme or port' };
    }
    const literal = current.hostname.replace(/^\[|\]$/g, '');
    if (isIP(literal) && isBlockedAddress(literal)) {
      return { hops, finalStatus: null, stoppedBecause: 'points to a private network address' };
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return { hops, finalStatus: null, stoppedBecause: 'took too long' };

    let result: HopResult;
    try {
      result = await request(current, Math.min(HOP_TIMEOUT_MS, remaining));
    } catch (error) {
      const code = (error as { code?: string }).code;
      const reason = code === 'EBLOCKED' ? 'points to a private network address'
        : code === 'ENOTFOUND' ? 'website does not exist (no DNS record)'
        : code === 'ETIMEOUT' ? 'took too long' : 'could not connect';
      return { hops, finalStatus: null, stoppedBecause: reason };
    }
    if (result.status < 300 || result.status >= 400 || !result.location) {
      return { hops, finalStatus: result.status, stoppedBecause: null };
    }
    current = new URL(result.location, current);
    hops.push(current.hostname);
  }
  return { hops, finalStatus: null, stoppedBecause: 'too many redirects' };
}

/** Registration date from RDAP (public registry data). Returns null when the registry has no RDAP record. */
export async function domainAgeDays(domain: string, fetchFn: typeof fetch = fetch): Promise<number | null> {
  try {
    const res = await fetchFn(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: AbortSignal.timeout(RDAP_TIMEOUT_MS),
      headers: { accept: 'application/rdap+json' },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { events?: { eventAction?: string; eventDate?: string }[] };
    const registered = body.events?.find((e) => e.eventAction === 'registration')?.eventDate;
    if (!registered) return null;
    return Math.floor((Date.now() - Date.parse(registered)) / 86_400_000);
  } catch {
    return null; // RDAP is best effort: no age is "unknown", never "old"
  }
}

export async function inspectLink(rawUrl: string): Promise<ToolResult> {
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `http://${rawUrl.trim()}`);
  } catch {
    return { ok: false, signals: [], data: { error: 'not a valid link' } };
  }

  const signals = staticLinkSignals(url);
  const [redirects, ageDays] = await Promise.all([followRedirects(url), domainAgeDays(registrableDomain(url.hostname))]);

  const finalHost = redirects.hops.at(-1) ?? url.hostname;
  if (registrableDomain(finalHost) !== registrableDomain(url.hostname)) {
    signals.push(signal('link_redirects_elsewhere', 'medium', `The link redirects to a different website (${registrableDomain(finalHost)}).`));
    signals.push(...staticLinkSignals(new URL(`https://${finalHost}`)).filter((s) => s.code === 'link_lookalike'));
  }
  if (redirects.stoppedBecause === 'points to a private network address') {
    signals.push(signal('link_private_address', 'medium', 'The link points to a private network address.'));
  }
  if (ageDays !== null && ageDays < NEW_DOMAIN_DAYS) {
    signals.push(signal('link_new_domain', 'high', `The website was registered only ${ageDays} day(s) ago.`));
  }

  return {
    ok: true,
    signals,
    data: {
      domain: registrableDomain(url.hostname),
      redirect_chain: redirects.hops,
      final_status: redirects.finalStatus,
      stopped_because: redirects.stoppedBecause,
      domain_age_days: ageDays,
    },
  };
}
