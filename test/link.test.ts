import { describe, expect, it } from 'vitest';
import {
  domainAgeDays, followRedirects, headersShowAndroidApp, isBlockedAddress, registrableDomain, staticLinkSignals,
} from '../src/tools/link.ts';

const codes = (url: string) => staticLinkSignals(new URL(url)).map((s) => s.code);

describe('isBlockedAddress (SSRF guard)', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.20.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:192.168.1.1'])(
    'blocks %s', (address) => expect(isBlockedAddress(address)).toBe(true),
  );
  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])('allows public %s', (address) => {
    expect(isBlockedAddress(address)).toBe(false);
  });
});

describe('staticLinkSignals', () => {
  it('flags a lookalike of a Malaysian bank', () => {
    expect(codes('https://maybank2u-secure-login.com/x')).toContain('link_lookalike');
  });
  it('flags a spelled-out official domain on another TLD', () => {
    expect(codes('https://pos-com-my.online/mypost')).toContain('link_lookalike');
  });
  it('does not flag the official site', () => {
    expect(codes('https://www.maybank2u.com.my/home')).not.toContain('link_lookalike');
  });
  it('flags userinfo, punycode and APK tricks', () => {
    expect(codes('https://maybank2u.com.my@evil.example/')).toContain('link_userinfo_trick');
    expect(codes('https://mаybank2u.com/')).toContain('link_punycode'); // Cyrillic "а" becomes xn--...
    expect(codes('https://files.example/update.apk')).toContain('link_apk_download');
  });
  it('uses three labels for .com.my domains', () => {
    expect(registrableDomain('www.maybank2u.com.my')).toBe('maybank2u.com.my');
    expect(registrableDomain('a.b.example.com')).toBe('example.com');
  });
});

describe('followRedirects', () => {
  it('stops at a redirect into a private address', async () => {
    const result = await followRedirects(new URL('https://example.com/'), async () => ({ status: 302, location: 'http://169.254.169.254/latest' }));
    expect(result.stoppedBecause).toBe('points to a private network address');
  });
  it('refuses non-web ports', async () => {
    const result = await followRedirects(new URL('https://example.com/'), async () => ({ status: 301, location: 'http://example.org:8080/' }));
    expect(result.stoppedBecause).toBe('unsupported scheme or port');
  });
  it('gives up after 5 redirects', async () => {
    let n = 0;
    const result = await followRedirects(new URL('https://a.example/'), async () => ({ status: 302, location: `https://hop${++n}.example/` }));
    expect(result.stoppedBecause).toBe('too many redirects');
    expect(n).toBe(6);
  });
  it('detects an app download from headers when the URL hides ".apk"', async () => {
    const result = await followRedirects(new URL('https://kad-jemputan.example/download?id=1'),
      async () => ({ status: 200, location: null, servesAndroidApp: true }));
    expect(result.servesAndroidApp).toBe(true);
  });
  it('detects an app download when a redirect lands on an .apk path', async () => {
    let hop = 0;
    const result = await followRedirects(new URL('https://short.example/x'),
      async () => (hop++ === 0 ? { status: 302, location: 'https://cdn.example/files/invite.apk' } : { status: 200, location: null }));
    expect(result.servesAndroidApp).toBe(true);
  });
  it('blocks a hostname that resolves to loopback, inside the real DNS lookup', async () => {
    const result = await followRedirects(new URL('http://localhost/'));
    expect(result.stoppedBecause).toBe('points to a private network address');
  });
});

describe('headersShowAndroidApp', () => {
  it('reads the Android content type and APK attachment names', () => {
    expect(headersShowAndroidApp('application/vnd.android.package-archive', undefined)).toBe(true);
    expect(headersShowAndroidApp('application/octet-stream', 'attachment; filename="jemputan.apk"')).toBe(true);
    expect(headersShowAndroidApp('text/html; charset=utf-8', undefined)).toBe(false);
    expect(headersShowAndroidApp('application/pdf', 'attachment; filename="invoice.pdf"')).toBe(false);
  });
});

describe('domainAgeDays', () => {
  it('reads the registration date from RDAP', async () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString();
    const fakeFetch = (async () => new Response(JSON.stringify({ events: [{ eventAction: 'registration', eventDate: tenDaysAgo }] }))) as typeof fetch;
    expect(await domainAgeDays('example.com', fakeFetch)).toBe(10);
  });
  it('returns null (unknown) when RDAP fails', async () => {
    const failingFetch = (async () => { throw new Error('offline'); }) as typeof fetch;
    expect(await domainAgeDays('example.com', failingFetch)).toBeNull();
  });
});
