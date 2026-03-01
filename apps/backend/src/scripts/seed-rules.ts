/**
 * @file apps/backend/src/scripts/seed-rules.ts
 * @description Seeds confirmed GST rules into the MongoDB `gstrules` collection.
 * Only seeds rules explicitly confirmed from actual GST law — no hallucinated rules.
 *
 * Rules included:
 *   - BLOCKED_ITC rules under Section 17(5) of the CGST Act, 2017
 *   - RCM (Reverse Charge Mechanism) applicable services
 *   - ITC_ELIGIBILITY conditions
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

/**
 * Blocked ITC rules under Section 17(5) of the Central Goods and Services
 * Tax (CGST) Act, 2017. Input tax credit is NOT available for these items.
 */
const blockedItcRules: RuleInput[] = [
  {
    ruleId: 'RULE_BLOCKED_001',
    category: 'BLOCKED_ITC',
    title: 'Motor vehicles for transportation of persons',
    description:
      'Input tax credit shall not be available in respect of motor vehicles for transportation of persons having approved seating capacity of not more than thirteen persons (including the driver), except when they are used for making the following taxable supplies: (i) further supply of such motor vehicles; or (ii) transportation of passengers; or (iii) imparting training on driving such motor vehicles.',
    keywords: ['motor vehicle', 'transportation of persons', 'car', 'seating capacity', 'blocked'],
    gstSection: 'Section 17(5)(a)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_002',
    category: 'BLOCKED_ITC',
    title: 'Vessels and aircraft',
    description:
      'Input tax credit shall not be available in respect of vessels and aircraft, except when they are used for making the following taxable supplies: (i) further supply of such vessels or aircraft; or (ii) transportation of passengers; or (iii) imparting training on navigating such vessels; or (iv) imparting training on flying such aircraft; or (v) transportation of goods.',
    keywords: ['vessel', 'aircraft', 'boat', 'ship', 'aeroplane', 'blocked'],
    gstSection: 'Section 17(5)(aa)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_003',
    category: 'BLOCKED_ITC',
    title: 'Services of general insurance, servicing, repair and maintenance of motor vehicles, vessels or aircraft',
    description:
      'Input tax credit shall not be available in respect of services of general insurance, servicing, repair and maintenance in so far as they relate to motor vehicles, vessels or aircraft, except when used for the taxable supplies specified in Section 17(5)(a) and Section 17(5)(aa).',
    keywords: [
      'insurance',
      'repair',
      'maintenance',
      'motor vehicle',
      'vessel',
      'aircraft',
      'blocked',
    ],
    gstSection: 'Section 17(5)(ab)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_004',
    category: 'BLOCKED_ITC',
    title: 'Food and beverages, outdoor catering, beauty treatment, health services',
    description:
      'Input tax credit shall not be available in respect of the following supply of goods or services or both: food and beverages, outdoor catering, beauty treatment, health services, cosmetic and plastic surgery, except where an inward supply of goods or services or both of a particular category is used by a registered person for making an outward taxable supply of the same category of goods or services or both or as an element of a taxable composite or mixed supply.',
    keywords: [
      'food',
      'beverages',
      'outdoor catering',
      'beauty treatment',
      'health services',
      'cosmetic',
      'plastic surgery',
      'blocked',
    ],
    gstSection: 'Section 17(5)(b)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_005',
    category: 'BLOCKED_ITC',
    title: 'Membership of a club, health and fitness centre',
    description:
      'Input tax credit shall not be available in respect of membership of a club, health and fitness centre.',
    keywords: ['club', 'health', 'fitness', 'gym', 'membership', 'blocked'],
    gstSection: 'Section 17(5)(b)(ii)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_006',
    category: 'BLOCKED_ITC',
    title: 'Travel benefits extended to employees on vacation',
    description:
      'Input tax credit shall not be available in respect of travel benefits extended to employees on vacation such as leave or home travel concession.',
    keywords: ['leave travel', 'home travel concession', 'LTC', 'vacation', 'employee travel', 'blocked'],
    gstSection: 'Section 17(5)(b)(iii)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_007',
    category: 'BLOCKED_ITC',
    title: 'Works contract services for construction of immovable property',
    description:
      'Input tax credit shall not be available in respect of works contract services when supplied for construction of an immovable property (other than plant and machinery), except where it is an input service for further supply of works contract service.',
    keywords: [
      'works contract',
      'construction',
      'immovable property',
      'building',
      'civil',
      'blocked',
    ],
    gstSection: 'Section 17(5)(c)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_008',
    category: 'BLOCKED_ITC',
    title: 'Goods or services for construction of immovable property on own account',
    description:
      'Input tax credit shall not be available in respect of goods or services or both received by a taxable person for construction of an immovable property on his own account including when such goods or services or both are used in the course or furtherance of business.',
    keywords: [
      'construction',
      'immovable property',
      'own account',
      'capitalized',
      'building',
      'blocked',
    ],
    gstSection: 'Section 17(5)(d)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_009',
    category: 'BLOCKED_ITC',
    title: 'Goods or services on which tax paid under composition scheme',
    description:
      'Input tax credit shall not be available in respect of goods or services or both on which tax has been paid under section 10 (composition levy).',
    keywords: ['composition scheme', 'composition levy', 'section 10', 'blocked'],
    gstSection: 'Section 17(5)(e)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_010',
    category: 'BLOCKED_ITC',
    title: 'Goods or services received by a non-resident taxable person',
    description:
      'Input tax credit shall not be available in respect of goods or services or both received by a non-resident taxable person except on goods imported by him.',
    keywords: ['non-resident', 'NRTP', 'non resident taxable person', 'blocked'],
    gstSection: 'Section 17(5)(f)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_011',
    category: 'BLOCKED_ITC',
    title: 'Goods or services used for personal consumption',
    description:
      'Input tax credit shall not be available in respect of goods or services or both used for personal consumption.',
    keywords: ['personal consumption', 'personal use', 'non-business', 'blocked'],
    gstSection: 'Section 17(5)(g)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_BLOCKED_012',
    category: 'BLOCKED_ITC',
    title: 'Goods lost, stolen, destroyed, written off or disposed of as gift or free sample',
    description:
      'Input tax credit shall not be available in respect of goods lost, stolen, destroyed, written off or disposed of by way of gift or free samples.',
    keywords: ['lost', 'stolen', 'destroyed', 'written off', 'gift', 'free sample', 'blocked'],
    gstSection: 'Section 17(5)(h)',
    gstr3bTable: '4(D)(2)',
    embedding: [],
    isActive: true,
  },
];

/**
 * Reverse Charge Mechanism (RCM) rules — services on which the recipient
 * must pay GST directly to the government under Section 9(3) of the CGST Act.
 */
const rcmRules: RuleInput[] = [
  {
    ruleId: 'RULE_RCM_001',
    category: 'RCM',
    title: 'Goods Transport Agency (GTA) services',
    description:
      'Services supplied by a Goods Transport Agency (GTA) in respect of transportation of goods by road are subject to Reverse Charge Mechanism. The recipient (if registered) must pay GST at the applicable rate.',
    keywords: ['GTA', 'goods transport agency', 'transportation of goods', 'road transport', 'RCM'],
    gstSection: 'Section 9(3)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_002',
    category: 'RCM',
    title: 'Legal services by advocate or firm of advocates',
    description:
      'Services supplied by an individual advocate or a firm of advocates by way of legal services, directly or indirectly, to any business entity are subject to Reverse Charge Mechanism.',
    keywords: ['advocate', 'lawyer', 'legal services', 'law firm', 'RCM'],
    gstSection: 'Section 9(3)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_003',
    category: 'RCM',
    title: 'Services by arbitral tribunal',
    description:
      'Services supplied by an arbitral tribunal to a business entity are subject to Reverse Charge Mechanism.',
    keywords: ['arbitral tribunal', 'arbitration', 'dispute resolution', 'RCM'],
    gstSection: 'Section 9(3)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_004',
    category: 'RCM',
    title: 'Sponsorship services',
    description:
      'Services supplied by any person by way of sponsorship to any body corporate or partnership firm are subject to Reverse Charge Mechanism.',
    keywords: ['sponsorship', 'sponsoring', 'body corporate', 'RCM'],
    gstSection: 'Section 9(3)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_005',
    category: 'RCM',
    title: 'Services by Government or local authority',
    description:
      'Services supplied by the Central Government, State Government, Union territory or local authority to a business entity, excluding renting of immovable property, services by the Department of Posts, services in relation to an aircraft or a vessel, and transport of goods or passengers, are subject to Reverse Charge Mechanism.',
    keywords: ['government', 'local authority', 'municipal', 'state government', 'RCM'],
    gstSection: 'Section 9(3)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_006',
    category: 'RCM',
    title: 'Services by director to a body corporate',
    description:
      'Services supplied by a director of a company or a body corporate to the said company or the body corporate are subject to Reverse Charge Mechanism.',
    keywords: ['director', 'body corporate', 'company', 'RCM'],
    gstSection: 'Section 9(3)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_007',
    category: 'RCM',
    title: 'Insurance agent services',
    description:
      'Services supplied by an insurance agent to any person carrying on insurance business are subject to Reverse Charge Mechanism.',
    keywords: ['insurance agent', 'insurance', 'policy', 'RCM'],
    gstSection: 'Section 9(3)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_008',
    category: 'RCM',
    title: 'Recovery agent services',
    description:
      'Services supplied by a recovery agent to a banking company or a financial institution or a non-banking financial company are subject to Reverse Charge Mechanism.',
    keywords: ['recovery agent', 'banking', 'financial institution', 'NBFC', 'RCM'],
    gstSection: 'Section 9(3)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_009',
    category: 'RCM',
    title: 'Author/music composer/photographer/artist — copyright transfer',
    description:
      'Services supplied by an author, music composer, photographer, artist or the like by way of transfer or permitting the use or enjoyment of a copyright to a publisher, music company, producer or the like are subject to Reverse Charge Mechanism.',
    keywords: ['author', 'music composer', 'photographer', 'artist', 'copyright', 'RCM'],
    gstSection: 'Section 9(3)',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_RCM_010',
    category: 'RCM',
    title: 'Import of services by a taxable person',
    description:
      'Services imported by a taxable person in India (other than a non-taxable online recipient) are subject to Integrated GST (IGST) under Reverse Charge Mechanism, regardless of whether the supplier is registered or not.',
    keywords: ['import of services', 'OIDAR', 'cross border', 'foreign supplier', 'RCM'],
    gstSection: 'Section 5(3) IGST Act',
    gstr3bTable: '3.1(d)',
    embedding: [],
    isActive: true,
  },
];

/**
 * ITC eligibility conditions — the five conditions that must ALL be satisfied
 * for a taxpayer to claim Input Tax Credit under Section 16 of the CGST Act.
 */
const itcEligibilityRules: RuleInput[] = [
  {
    ruleId: 'RULE_ITC_ELIG_001',
    category: 'ITC_ELIGIBILITY',
    title: 'Invoice or debit note must be present in GSTR-2B',
    description:
      'A registered person shall be entitled to take credit of input tax only if the tax charged in respect of such supply has been actually paid to the Government, either in cash or through utilisation of ITC, and the recipient has received a tax invoice or debit note issued by the supplier, and such details have been furnished by the supplier in their GSTR-1 or IFF, and such details appear in the recipient\'s GSTR-2B.',
    keywords: ['GSTR-2B', 'invoice', 'debit note', 'ITC eligibility', 'matching', 'section 16(2)(aa)'],
    gstSection: 'Section 16(2)(aa)',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_ITC_ELIG_002',
    category: 'ITC_ELIGIBILITY',
    title: 'Goods or services must be received',
    description:
      'A registered person shall be entitled to take credit of input tax only if the goods or services or both have been actually received by the registered person. In case of goods received in lots or installments, ITC is available only upon receipt of the last lot or installment.',
    keywords: ['goods received', 'services received', 'delivery', 'receipt', 'section 16(2)(b)'],
    gstSection: 'Section 16(2)(b)',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_ITC_ELIG_003',
    category: 'ITC_ELIGIBILITY',
    title: 'Tax must have been actually paid by supplier',
    description:
      'A registered person shall be entitled to take credit of input tax only if the tax charged in respect of such supply has been actually paid to the Government, either in cash or through utilisation of input tax credit admitted in the electronic credit ledger of the supplier.',
    keywords: ['tax paid', 'supplier payment', 'actually paid', 'section 16(2)(c)', 'ITC eligibility'],
    gstSection: 'Section 16(2)(c)',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_ITC_ELIG_004',
    category: 'ITC_ELIGIBILITY',
    title: 'GST return must have been filed by buyer',
    description:
      'A registered person shall be entitled to take credit of input tax only if the registered person has furnished the return under Section 39 (i.e., GSTR-3B) for the relevant tax period.',
    keywords: ['GSTR-3B', 'return filing', 'section 39', 'buyer return', 'ITC eligibility'],
    gstSection: 'Section 16(2)(d)',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
  {
    ruleId: 'RULE_ITC_ELIG_005',
    category: 'ITC_ELIGIBILITY',
    title: 'ITC on capital goods — not blocked under Section 17(5)',
    description:
      'Input tax credit is available on capital goods used or intended to be used in the course or furtherance of business, provided the credit is not blocked under Section 17(5) of the CGST Act. Depreciation cannot be claimed on the GST component if ITC is availed.',
    keywords: ['capital goods', 'plant and machinery', 'section 17(5)', 'ITC eligibility', 'depreciation'],
    gstSection: 'Section 16(1)',
    gstr3bTable: '4(A)(5)',
    embedding: [],
    isActive: true,
  },
];

// ---------------------------------------------------------------------------
// Seeder function
// ---------------------------------------------------------------------------

/**
 * Connects to MongoDB and upserts all confirmed GST rules.
 * Uses upsert so the script is safe to run multiple times without creating duplicates.
 */
async function seedRules(): Promise<void> {
  console.log('[Seed Rules] Starting GST rules seeding...');

  await connectDB();

  const allRules: RuleInput[] = [
    ...blockedItcRules,
    ...rcmRules,
    ...itcEligibilityRules,
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
      console.log(`[Seed Rules]   ✓ Inserted: ${rule.ruleId} — ${rule.title}`);
    } else {
      updatedCount++;
      console.log(`[Seed Rules]   ↻ Updated:  ${rule.ruleId} — ${rule.title}`);
    }
  }

  console.log(`[Seed Rules] Done. Inserted: ${insertedCount}, Updated: ${updatedCount}`);
  await mongoose.disconnect();
}

// Run if called directly
seedRules().catch((error) => {
  console.error('[Seed Rules] Fatal error:', error);
  process.exit(1);
});
