// official_contact: curated official websites for organisations scammers often impersonate in Malaysia.
// Keywords are what a lookalike domain tends to contain; keep them distinctive so real sites don't match by accident.

import type { ToolResult } from '../evidence.ts';

export interface OfficialOrg {
  name: string;
  domains: string[];
  keywords: string[];
}

export const SCAM_HOTLINE = 'National Scam Response Centre (NSRC): call 997';

export const OFFICIAL_DOMAINS: OfficialOrg[] = [
  { name: 'Maybank', domains: ['maybank2u.com.my', 'maybank.com', 'maybank.com.my'], keywords: ['maybank', 'maybank2u'] },
  { name: 'CIMB', domains: ['cimb.com.my', 'cimbclicks.com.my', 'cimb.com'], keywords: ['cimb'] },
  { name: 'Public Bank', domains: ['pbebank.com', 'publicbank.com.my'], keywords: ['publicbank', 'pbebank'] },
  { name: 'RHB', domains: ['rhbgroup.com', 'rhbbank.com.my'], keywords: ['rhbbank', 'rhbgroup', 'rhbnow'] },
  { name: 'Hong Leong Bank', domains: ['hlb.com.my', 'hongleongconnect.my'], keywords: ['hongleong'] },
  { name: 'AmBank', domains: ['ambank.com.my', 'ambankgroup.com'], keywords: ['ambank'] },
  { name: 'Bank Islam', domains: ['bankislam.com', 'bankislam.com.my'], keywords: ['bankislam'] },
  { name: 'Bank Negara Malaysia', domains: ['bnm.gov.my'], keywords: ['banknegara'] },
  { name: 'Pos Malaysia', domains: ['pos.com.my'], keywords: ['poslaju', 'posmalaysia'] },
  { name: 'JPJ', domains: ['jpj.gov.my'], keywords: ['jpj'] },
  { name: 'LHDN', domains: ['hasil.gov.my'], keywords: ['lhdn'] },
  { name: 'PDRM', domains: ['rmp.gov.my'], keywords: ['pdrm'] },
  { name: 'KWSP / EPF', domains: ['kwsp.gov.my'], keywords: ['kwsp'] },
  { name: 'PERKESO', domains: ['perkeso.gov.my'], keywords: ['perkeso'] },
  { name: "Touch 'n Go", domains: ['touchngo.com.my', 'tngdigital.com.my'], keywords: ['touchngo', 'tngdigital', 'tngewallet'] },
  { name: 'Shopee', domains: ['shopee.com.my', 'shopee.com'], keywords: ['shopee'] },
  { name: 'Lazada', domains: ['lazada.com.my', 'lazada.com'], keywords: ['lazada'] },
];

export function officialContact(orgName: string): ToolResult {
  const query = orgName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const org = OFFICIAL_DOMAINS.find(
    (o) => o.name.toLowerCase().replace(/[^a-z0-9]/g, '').includes(query) || o.keywords.some((k) => query.includes(k)),
  );
  return {
    ok: Boolean(org),
    signals: [],
    data: {
      organisation: org?.name ?? null,
      official_websites: org?.domains ?? [],
      scam_hotline: SCAM_HOTLINE,
      advice: 'Contact the organisation through its official website or app, never through numbers or links in the message.',
    },
  };
}
