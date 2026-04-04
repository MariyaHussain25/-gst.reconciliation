import asyncio
import os
import sys

# Add the app directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.mongodb import init_db
from app.models.gst_rule import GstRule
from app.services.itc_rules_service import _get_query_embedding

# A sample of essential GST rules to seed
SAMPLE_RULES = [
    {
        "rule_id": "SEC_16_4",
        "category": "ITC_ELIGIBILITY",
        "title": "Time Limit for Availing ITC - Section 16(4)",
        "description": "A registered person shall not be entitled to take input tax credit in respect of any invoice or debit note for supply of goods or services or both after the 30th day of November following the end of financial year to which such invoice or debit note pertains or furnishing of the relevant annual return, whichever is earlier.",
        "keywords": ["time limit", "deadline", "november", "annual return", "16(4)", "late ITC"],
        "gst_section": "16(4)",
        "gstr3b_table": "4(A)(5)"
    },
    {
        "rule_id": "SEC_17_5",
        "category": "BLOCKED_ITC",
        "title": "Blocked Credits - Section 17(5)",
        "description": "Input tax credit shall not be available in respect of: motor vehicles for transportation of persons having approved seating capacity of not more than thirteen persons, food and beverages, outdoor catering, beauty treatment, health services, cosmetic and plastic surgery, membership of a club, health and fitness centre, travel benefits extended to employees on vacation.",
        "keywords": ["blocked", "ineligible", "17(5)", "motor vehicle", "food", "catering"],
        "gst_section": "17(5)",
        "gstr3b_table": "4(D)(1)"
    },
    {
        "rule_id": "RULE_36_4",
        "category": "MATCHING",
        "title": "Condition for ITC availment - Rule 36(4)",
        "description": "Input tax credit to be availed by a registered person in respect of invoices or debit notes, the details of which have not been furnished by the suppliers under sub-section (1) of section 37 in FORM GSTR-1 or using the invoice furnishing facility, shall not exceed 5 per cent of the eligible credit available in respect of invoices or debit notes the details of which have been furnished by the suppliers.",
        "keywords": ["matching", "36(4)", "5 percent", "GSTR-2B", "supplier", "provisional"],
        "gst_section": "Rule 36(4)",
        "gstr3b_table": "4(A)"
    }
]

async def seed_gst_rules():
    print("Initializing Database...")
    await init_db()
    
    print("Clearing existing rules...")
    await GstRule.find_all().delete()
    
    print(f"Seeding {len(SAMPLE_RULES)} GST rules...")
    for rule_data in SAMPLE_RULES:
        print(f"Generating embedding for: {rule_data['title']}...")
        
        # Combine title and description for a richer embedding
        text_to_embed = f"{rule_data['title']}. {rule_data['description']}"
        embedding = _get_query_embedding(text_to_embed)
        
        if not embedding:
            print("⚠️ Warning: Could not generate embedding. Is GOOGLE_API_KEY set?")
        
        rule = GstRule(
            rule_id=rule_data["rule_id"],
            category=rule_data["category"],
            title=rule_data["title"],
            description=rule_data["description"],
            keywords=rule_data["keywords"],
            gst_section=rule_data["gst_section"],
            gstr3b_table=rule_data["gstr3b_table"],
            embedding=embedding
        )
        await rule.insert()
        print(f"✅ Inserted: {rule.rule_id}")

    print("🎉 Seeding complete!")

if __name__ == "__main__":
    asyncio.run(seed_gst_rules())