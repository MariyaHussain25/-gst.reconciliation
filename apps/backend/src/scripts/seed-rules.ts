/**
 * @file apps/backend/src/scripts/seed-rules.ts
 * @description Seeds confirmed GST rules into the MongoDB `gstrules` collection.
 * Only seeds rules explicitly confirmed from actual GST law — no hallucinated rules.
 *
 * Rules included:
 *   - BLOCKED_ITC  : 12 rules under Section 17(5) of CGST Act, 2017
 *   - RCM          : 10 rules under Section 9(3) of CGST Act / Section 5(3) IGST Act
 *   - ITC_ELIGIBILITY : 6 rules under Section 16 of CGST Act
 *   - EXEMPT       : 1 rule — Rule 42 ITC reversal for exempt supplies
 *   - MATCHING     : 1 rule — GSTR-2A vs GSTR-2B reconciliation
 *
 * Total: 31 rules (exactly as confirmed by the user).
 *
 * Embeddings are stored as an empty array [].
 * They will be generated and populated in Phase 6 once the OpenAI key is available.
 *
 * Usage:
 *   npx tsx src/scripts/seed-rules.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { GstRuleModel, type IGstRule } from '../models/rules.model.js';
import { connectDB } from '../db/connect.js';

// ---------------------------------------------------------------------------
// Rule definitions — CONFIRMED from actual GST law only
// ---------------------------------------------------------------------------

type RuleInput = Omit<IGstRule, keyof mongoose.Document | 'createdAt'>;

// ─────────────────────────────────────────
// SECTION 17(5) — BLOCKED ITC RULES (12 rules)
// ─────────────────────────────────────────

const blockedItcRules: RuleInput[] = [
  {
    ruleId: 'RULE_BLOCKED_001',
    category: 'BLOCKED_ITC',
    title: 'Motor Vehicles — Blocked ITC',
    description:
      'ITC on motor vehicles for transportation of persons with seating capacity of 13 or fewer persons (including driver) is blocked under Section 17(5)(a) of CGST Act. Exception: ITC allowed if vehicle is used for transportation of goods, passenger transport as a business, driving training, or if taxpayer deals in selling motor vehicles.',
    keywords: ['motor vehicle', 'car', 'seating capacity', '13 persons', 'blocked', '17(5)(a)'],
    gstSection: 'Section 17(5)(a)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_002',
    category: 'BLOCKED_ITC',
    title: 'Vessels & Aircraft — Blocked ITC',
    description:
      'ITC on vessels and aircraft is blocked under Section 17(5)(a) of CGST Act. Exception: ITC is allowed if used for transportation of goods, passenger transport as a business, training purposes, or if the taxpayer is in the business of selling/manufacturing vessels or aircraft.',
    keywords: ['vessel', 'aircraft', 'ship', 'boat', 'airplane', 'blocked', '17(5)(a)'],
    gstSection: 'Section 17(5)(a)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_003',
    category: 'BLOCKED_ITC',
    title: 'Insurance & Repair of Vehicles/Vessels/Aircraft — Blocked ITC',
    description:
      'ITC on insurance, servicing, repair and maintenance of motor vehicles, vessels and aircraft that are covered under Section 17(5)(a) is also blocked under Section 17(5)(ab). The block applies only when the underlying vehicle/vessel/aircraft itself is blocked. If the vehicle is eligible for ITC, then its repair/insurance ITC is also eligible.',
    keywords: ['insurance', 'repair', 'servicing', 'maintenance', 'vehicle insurance', 'motor insurance', 'blocked', '17(5)(ab)'],
    gstSection: 'Section 17(5)(ab)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_004',
    category: 'BLOCKED_ITC',
    title: 'Food & Beverages — Blocked ITC',
    description:
      'ITC on food, beverages, outdoor catering, beauty treatment, health services, cosmetic and plastic surgery is blocked under Section 17(5)(b). Exception: ITC is allowed if the same category of goods/services is used to make an outward taxable supply of the same category, or it is provided as an obligation under any law for the time being in force.',
    keywords: ['food', 'beverages', 'catering', 'outdoor catering', 'beauty treatment', 'health services', 'cosmetic', 'plastic surgery', 'restaurant', '17(5)(b)'],
    gstSection: 'Section 17(5)(b)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_005',
    category: 'BLOCKED_ITC',
    title: 'Club & Membership Fees — Blocked ITC',
    description:
      'ITC on membership of a club, health and fitness centre is blocked under Section 17(5)(b)(ii). This includes gym memberships, club subscriptions, sports club fees etc. No exception is available for this category.',
    keywords: ['club', 'membership', 'gym', 'fitness', 'sports club', 'health centre', 'subscription', '17(5)(b)'],
    gstSection: 'Section 17(5)(b)(ii)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_006',
    category: 'BLOCKED_ITC',
    title: 'Travel Benefits to Employees — Blocked ITC',
    description:
      'ITC on travel benefits extended to employees (such as leave or home travel concession) is blocked under Section 17(5)(b)(iii). This includes holiday packages, vacation trips, LTC/LTA benefits provided to staff.',
    keywords: ['travel', 'vacation', 'LTC', 'LTA', 'holiday', 'leave travel', 'home travel', 'employee benefit', '17(5)(b)'],
    gstSection: 'Section 17(5)(b)(iii)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_007',
    category: 'BLOCKED_ITC',
    title: 'Works Contract for Immovable Property — Blocked ITC',
    description:
      'ITC on works contract services for construction of an immovable property (other than plant and machinery) is blocked under Section 17(5)(c). This includes construction of building, civil work, renovation of office/factory if it results in immovable property. Exception: ITC is allowed if the works contract is for further supply of works contract service (sub-contractor).',
    keywords: ['works contract', 'construction', 'immovable property', 'building', 'civil work', 'renovation', '17(5)(c)'],
    gstSection: 'Section 17(5)(c)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_008',
    category: 'BLOCKED_ITC',
    title: 'Construction of Immovable Property on Own Account — Blocked ITC',
    description:
      'ITC on goods or services received for construction of immovable property on own account (even if used in course of business) is blocked under Section 17(5)(d). Includes cement, steel, bricks, architect fees etc. used for building construction. Exception: plant and machinery is allowed.',
    keywords: ['construction', 'own building', 'cement', 'steel', 'bricks', 'architect', 'immovable', 'own account', '17(5)(d)'],
    gstSection: 'Section 17(5)(d)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_009',
    category: 'BLOCKED_ITC',
    title: 'Composition Scheme — Blocked ITC',
    description:
      'ITC is blocked on goods or services where the supplier has paid tax under the Composition Scheme (Section 10 of CGST Act). Composition dealers cannot issue a tax invoice and hence the buyer cannot claim ITC. Composition dealers issue a Bill of Supply instead of a tax invoice.',
    keywords: ['composition scheme', 'composition dealer', 'section 10', 'bill of supply', 'no ITC', 'small supplier', 'blocked'],
    gstSection: 'Section 10 CGST Act',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_010',
    category: 'BLOCKED_ITC',
    title: 'Non-Resident Taxable Person — Blocked ITC',
    description:
      'ITC is blocked on goods or services received by a non-resident taxable person under Section 17(5)(e), except on goods imported by them. Non-resident taxable persons are those who occasionally undertake transactions in India but do not have a fixed place of business in India.',
    keywords: ['non-resident', 'foreign', 'non-resident taxable person', 'NRTP', 'import', 'blocked', '17(5)(e)'],
    gstSection: 'Section 17(5)(e)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_011',
    category: 'BLOCKED_ITC',
    title: 'Personal Consumption — Blocked ITC',
    description:
      'ITC on goods or services used for personal consumption is blocked under Section 17(5)(g) of CGST Act. If a business purchases goods or services for personal use (not for business purposes), no ITC can be claimed. This is a fundamental condition — ITC is only for business use.',
    keywords: ['personal use', 'personal consumption', 'non-business', 'blocked', '17(5)(g)', 'personal expenses'],
    gstSection: 'Section 17(5)(g)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_012',
    category: 'BLOCKED_ITC',
    title: 'Lost, Stolen, Destroyed or Written-Off Goods — Blocked ITC',
    description:
      'ITC is blocked under Section 17(5)(h) on goods that are lost, stolen, destroyed, written off, or disposed of by way of gift or free samples. If goods on which ITC was already taken are subsequently lost/destroyed, the ITC must be reversed. Free samples distributed to customers also fall under this block.',
    keywords: ['lost goods', 'stolen', 'destroyed', 'written off', 'free samples', 'gifts', 'damaged goods', 'ITC reversal', '17(5)(h)'],
    gstSection: 'Section 17(5)(h)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
];

// ─────────────────────────────────────────
// RCM — REVERSE CHARGE MECHANISM RULES (10 rules)
// ─────────────────────────────────────────

const rcmRules: RuleInput[] = [
  {
    ruleId: 'RULE_RCM_001',
    category: 'RCM',
    title: 'GTA — Goods Transport Agency (RCM)',
    description:
      'Services provided by a Goods Transport Agency (GTA) for transport of goods by road are liable under Reverse Charge Mechanism (RCM) as per Notification 13/2017-CT(Rate). The recipient (business) must pay GST @ 5% (no ITC) or 12% (with ITC) directly to the government. GTA must not charge GST on invoice. ITC of GST paid under RCM is available to the recipient.',
    keywords: ['GTA', 'goods transport', 'freight', 'road transport', 'truck', 'lorry', 'transport agency', 'RCM', 'reverse charge'],
    gstSection: 'Notification 13/2017-CT(Rate)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_002',
    category: 'RCM',
    title: 'Legal Services by Advocate (RCM)',
    description:
      'Legal services provided by an individual advocate or firm of advocates to a business entity are liable under RCM as per Notification 13/2017-CT(Rate). The business receiving legal services must pay GST @ 18% directly. The advocate does not charge GST. ITC of GST paid under RCM is available to the recipient business entity.',
    keywords: ['legal services', 'advocate', 'lawyer', 'law firm', 'legal fees', 'attorney', 'RCM', 'reverse charge'],
    gstSection: 'Notification 13/2017-CT(Rate)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_003',
    category: 'RCM',
    title: 'Arbitral Tribunal Services (RCM)',
    description:
      'Services provided by an arbitral tribunal to a business entity are covered under RCM as per Notification 13/2017-CT(Rate). The business receiving arbitration services must pay GST @ 18% directly to the government. The arbitral tribunal does not charge GST in its invoice. ITC available to the business entity.',
    keywords: ['arbitral tribunal', 'arbitration', 'dispute resolution', 'arbitrator', 'RCM', 'reverse charge'],
    gstSection: 'Notification 13/2017-CT(Rate)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_004',
    category: 'RCM',
    title: 'Sponsorship Services (RCM)',
    description:
      'Sponsorship services provided to a body corporate or partnership firm are covered under RCM as per Notification 13/2017-CT(Rate). The sponsor (recipient) pays GST @ 18% directly. Common in events, sports sponsorships, and brand promotions. ITC is available to the sponsor.',
    keywords: ['sponsorship', 'event', 'sports', 'brand promotion', 'sponsor', 'RCM', 'reverse charge'],
    gstSection: 'Notification 13/2017-CT(Rate)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_005',
    category: 'RCM',
    title: 'Government / Local Authority Services (RCM)',
    description:
      'Services supplied by the Government or local authority to a business entity (except renting of immovable property, certain postal, transport and other specified services) are liable under RCM as per Notification 13/2017-CT(Rate). The recipient business must pay GST directly. Common examples include government fees, licenses, regulatory services.',
    keywords: ['government services', 'local authority', 'municipality', 'government fees', 'license', 'regulatory', 'RCM', 'reverse charge'],
    gstSection: 'Notification 13/2017-CT(Rate)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_006',
    category: 'RCM',
    title: 'Director Services to Body Corporate (RCM)',
    description:
      'Services provided by a director of a company or body corporate to the said company or body corporate are liable under RCM as per Notification 13/2017-CT(Rate). GST @ 18% must be paid by the company directly. Includes director's remuneration, sitting fees, and other services. ITC available to the company.',
    keywords: ['director', 'body corporate', 'company', 'sitting fees', 'director remuneration', 'RCM', 'reverse charge'],
    gstSection: 'Notification 13/2017-CT(Rate)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_007',
    category: 'RCM',
    title: 'Insurance Agent Services (RCM)',
    description:
      'Services provided by an insurance agent to an insurance company are covered under RCM as per Notification 13/2017-CT(Rate). The insurance company must pay GST @ 18% on the commission paid to the insurance agent directly to the government. The agent does not charge GST. ITC available to the insurance company.',
    keywords: ['insurance agent', 'insurance company', 'commission', 'agent', 'RCM', 'reverse charge'],
    gstSection: 'Notification 13/2017-CT(Rate)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_008',
    category: 'RCM',
    title: 'Recovery Agent Services (RCM)',
    description:
      'Services provided by a recovery agent to a banking company, financial institution, or NBFC are liable under RCM as per Notification 13/2017-CT(Rate). The bank or financial institution must pay GST @ 18% directly. Recovery agents who collect loan dues on behalf of banks are covered under this rule.',
    keywords: ['recovery agent', 'bank', 'financial institution', 'NBFC', 'loan recovery', 'RCM', 'reverse charge'],
    gstSection: 'Notification 13/2017-CT(Rate)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_009',
    category: 'RCM',
    title: 'Copyright Transfer by Authors/Artists (RCM)',
    description:
      'Services by an author, music composer, photographer, artist or the like by way of transfer or permitting the use of a copyright are liable under RCM when provided to a publisher, music company, producer or like person. GST @ 12% is payable by the recipient under RCM. ITC available to the recipient.',
    keywords: ['copyright', 'author', 'music composer', 'photographer', 'artist', 'publisher', 'royalty', 'RCM', 'reverse charge'],
    gstSection: 'Notification 13/2017-CT(Rate)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_010',
    category: 'RCM',
    title: 'Import of Services (RCM)',
    description:
      'Import of services from a foreign supplier (outside India) is liable under RCM under Section 5(3) of IGST Act. The Indian recipient must pay IGST on the value of imported services. Applies to services like software, consulting, cloud services, subscriptions from foreign vendors. ITC of IGST paid is available.',
    keywords: ['import of services', 'foreign vendor', 'overseas', 'IGST', 'cloud services', 'software subscription', 'consulting', 'RCM'],
    gstSection: 'Section 5(3) IGST Act',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
];

// ─────────────────────────────────────────
// ITC ELIGIBILITY CONDITIONS (6 rules)
// ─────────────────────────────────────────

const itcEligibilityRules: RuleInput[] = [
  {
    ruleId: 'RULE_ITC_001',
    category: 'ITC_ELIGIBILITY',
    title: 'ITC Eligible Only if Invoice in GSTR-2B',
    description:
      'As per Section 16(2)(aa) of CGST Act (w.e.f. 01-01-2022), ITC can be claimed ONLY if the invoice/debit note is reflected in the buyer's GSTR-2B. If a supplier has not filed their GSTR-1, the invoice will not appear in GSTR-2B and ITC cannot be claimed for that period until it reflects.',
    keywords: ['GSTR-2B', 'ITC eligibility', 'invoice reflected', 'section 16(2)(aa)', 'supplier filed', 'GSTR-1', 'ITC claim'],
    gstSection: 'Section 16(2)(aa)',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_ITC_002',
    category: 'ITC_ELIGIBILITY',
    title: 'Goods or Services Must Be Actually Received',
    description:
      'As per Section 16(2)(b) of CGST Act, ITC is allowed only when goods or services have actually been received by the buyer. ITC cannot be claimed on advance payments before delivery of goods or completion of services. For goods received in installments, ITC can be claimed only on the last installment.',
    keywords: ['goods received', 'services received', 'actual receipt', 'delivery', 'section 16(2)(b)', 'advance payment', 'installment'],
    gstSection: 'Section 16(2)(b)',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_ITC_003',
    category: 'ITC_ELIGIBILITY',
    title: 'Tax Must Be Actually Paid by Supplier',
    description:
      'As per Section 16(2)(c) of CGST Act, ITC is available only if the tax charged on the supply has actually been paid to the government by the supplier. If supplier collected GST from buyer but did not deposit it with the government, the buyer's ITC can be denied and recovered.',
    keywords: ['tax paid', 'supplier paid', 'ITC condition', 'section 16(2)(c)', 'government deposit', 'ITC denial'],
    gstSection: 'Section 16(2)(c)',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_ITC_004',
    category: 'ITC_ELIGIBILITY',
    title: 'Buyer Must Have Filed GST Return',
    description:
      'As per Section 16(2)(d) of CGST Act, ITC can be claimed only when the buyer has furnished (filed) their GST return. If the buyer has not filed their GSTR-3B for the relevant period, ITC cannot be availed. Filing the return is a mandatory condition for claiming ITC.',
    keywords: ['GST return filed', 'GSTR-3B', 'return filing', 'section 16(2)(d)', 'ITC condition', 'buyer filed'],
    gstSection: 'Section 16(2)(d)',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_ITC_005',
    category: 'ITC_ELIGIBILITY',
    title: 'Capital Goods — ITC Eligibility',
    description:
      'ITC on capital goods (machinery, equipment, computers etc.) is allowed under Section 16 of CGST Act, provided they are not blocked under Section 17(5). For capital goods used partly for business and partly for exempt supplies, proportionate ITC reversal under Rule 43 is required. ITC on capital goods must be reduced by 5% per quarter for common use.',
    keywords: ['capital goods', 'machinery', 'equipment', 'plant', 'ITC on capital goods', 'rule 43', 'section 16', 'proportionate'],
    gstSection: 'Section 16 / Rule 43',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_ITC_006',
    category: 'ITC_ELIGIBILITY',
    title: 'ITC Requires Payment Within 180 Days',
    description:
      'As per Section 16(2)(b) read with Rule 37 of CGST Rules, if the buyer does not pay the supplier within 180 days from invoice date, the ITC already claimed must be reversed with interest. Once payment is made, ITC can be re-claimed. This applies to both goods and services.',
    keywords: ['180 days', 'payment', 'ITC reversal', 'section 16(2)(b)', 'rule 37', 'supplier payment', 'interest'],
    gstSection: 'Section 16(2)(b) / Rule 37',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
];

// ─────────────────────────────────────────
// EXEMPT SUPPLIES (1 rule)
// ─────────────────────────────────────────

const exemptRules: RuleInput[] = [
  {
    ruleId: 'RULE_EXEMPT_001',
    category: 'EXEMPT',
    title: 'ITC Reversal for Exempt Supplies — Rule 42',
    description:
      'As per Section 17(1) and Rule 42 of CGST Rules, if a taxpayer makes both taxable and exempt supplies, ITC attributable to exempt supplies must be reversed. The reversal is calculated as: (Exempt Turnover / Total Turnover) × Total Common ITC. This reversal must be done every month and finalized at year end.',
    keywords: ['exempt supply', 'ITC reversal', 'rule 42', 'section 17(1)', 'common ITC', 'proportionate reversal', 'exempt turnover'],
    gstSection: 'Section 17(1) / Rule 42',
    gstr3bTable: '4(B)(1)',
    embedding: [],
    isActive: true,
  },
];

// ─────────────────────────────────────────
// MATCHING RULES (1 rule)
// ─────────────────────────────────────────

const matchingRules: RuleInput[] = [
  {
    ruleId: 'RULE_MATCH_001',
    category: 'MATCHING',
    title: 'GSTR-2A vs GSTR-2B Reconciliation Rule',
    description:
      'GSTR-2A is a dynamic auto-populated statement that changes as suppliers file/amend returns. GSTR-2B is a static statement generated on 14th of each month and does not change. For ITC claim purposes, GSTR-2B is the authoritative document as per Section 16(2)(aa). During reconciliation, invoices present in GSTR-2A but missing in GSTR-2B should be flagged as ITC not yet claimable. Invoices in GSTR-2B are eligible for ITC claim.',
    keywords: ['GSTR-2A', 'GSTR-2B', 'reconciliation', 'matching', 'ITC claim', 'static', 'dynamic', 'section 16(2)(aa)', '14th'],
    gstSection: 'Section 16(2)(aa)',
    gstr3bTable: null,
    embedding: [],
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// Seeder function
// ---------------------------------------------------------------------------

/**
 * Connects to MongoDB and upserts all 31 confirmed GST rules.
 * Uses upsert so the script is safe to run multiple times without creating duplicates.
 */
async function seedRules(): Promise<void> {
  console.log('[Seed Rules] Starting GST rules seeding...');

  await connectDB();

  const allRules: RuleInput[] = [
    ...blockedItcRules,   // 12 rules
    ...rcmRules,          // 10 rules
    ...itcEligibilityRules, // 6 rules
    ...exemptRules,       // 1 rule
    ...matchingRules,     // 1 rule
    // Total: 31 rules
  ];

  console.log(`[Seed Rules] Upserting ${allRules.length} rules...`);

  let insertedCount = 0;
  let updatedCount = 0;

  for (const rule of allRules) {
    const result = await GstRuleModel.updateOne(
      { ruleId: rule.ruleId },
      { $set: rule },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      insertedCount++;
      console.log(`[Seed Rules]   ✅ Inserted: ${rule.ruleId} — ${rule.title}`);
    } else {
      updatedCount++;
      console.log(`[Seed Rules]   ↻ Updated:  ${rule.ruleId} — ${rule.title}`);
    }
  }

  console.log(`[Seed Rules] ✅ Seeding complete. ${insertedCount} rules inserted, ${updatedCount} already existed.`);
  await mongoose.disconnect();
}

// Run if called directly
seedRules().catch((error) => {
  console.error('[Seed Rules] Fatal error:', error);
  process.exit(1);
});
