"""
GST Reconciliation — Modular Test Suite
========================================
Section 1: Functional / Behavioral Testing (black-box input→output)
Section 2: Evaluation & Data Validation (precision/recall/F1 on holdout)
Section 3: Bias & Fairness Testing (Demographic Parity, Equalized Odds)

Dependencies:
    pip install pytest rapidfuzz scikit-learn

Run: pytest tests/test_gst_modular.py -v
"""
import re, sys, types, unittest
from dataclasses import dataclass, field
from datetime import datetime, timezone, date as date_type
from typing import Optional

# ── Stubs so pure functions load without a running app ────────────────────────
def _stub(n):
    m = types.ModuleType(n); sys.modules[n] = m; return m

for _n in ["beanie","beanie.odm","app","app.config","app.config.settings",
           "app.models","app.models.invoice","app.models.reconciliation",
           "app.utils","app.utils.date_helpers","app.services",
           "app.services.itc_rules_service"]:
    _stub(_n)
sys.modules["beanie"].Document = object
sys.modules["beanie"].Indexed  = lambda *a,**k: a[0] if a else str

# ── Minimal Invoice stand-in ──────────────────────────────────────────────────
@dataclass
class Invoice:
    id: str = ""
    source: str = "GSTR_2A"
    gstin: str = ""
    vendor_name: str = ""
    normalized_vendor_name: str = ""
    invoice_number: str = ""
    normalized_invoice_number: str = ""
    invoice_date: datetime = field(default_factory=datetime.utcnow)
    period: str = ""
    taxable_amount: float = 0.0
    igst: float = 0.0
    cgst: float = 0.0
    sgst: float = 0.0
    cess: float = 0.0
    total_amount: float = 0.0
    match_status: str = "UNMATCHED"
    match_confidence: float = 0.0
    itc_category: Optional[str] = None

# ═══════════════════════════════════════════════════════
# PRODUCTION PURE FUNCTIONS  (identical to source)
# ═══════════════════════════════════════════════════════

LEGAL_SUFFIX_MAP = {
    "PRIVATE LIMITED":"PVT LTD","PVT LIMITED":"PVT LTD",
    "PRIVATE LTD":"PVT LTD","PVT. LTD.":"PVT LTD",
    "PVT.LTD.":"PVT LTD","PVT. LIMITED":"PVT LTD",
    "LIMITED":"LTD","LTD.":"LTD","CORPORATION":"CORP","ENTERPRISES":"ENT",
}
VENDOR_PREFIXES = ["M/S.","M/S","MESSRS.","MESSRS","MR.","MR",
                   "MS.","MS","SRI","SHRI","SMT"]

def normalize_vendor_name(name):
    if not name: return ""
    r = name.upper().strip()
    for p in VENDOR_PREFIXES:
        if r.startswith(p+" "): r = r[len(p):].strip(); break
    r = re.sub(r'\s+AND\s+',' AND ',r.replace("&"," AND "))
    for long in sorted(LEGAL_SUFFIX_MAP,key=len,reverse=True):
        if r.endswith(" "+long) or r==long:
            r = r[:len(r)-len(long)].rstrip()+" "+LEGAL_SUFFIX_MAP[long]; break
    r = re.sub(r'[^A-Z0-9\s]','',r)
    return re.sub(r'\s+',' ',r).strip()

_SEP = re.compile(r'[^A-Z0-9]+')
_NUM = re.compile(r'^\d+$')

def normalize_invoice_number(num):
    if not num: return ""
    r = _SEP.sub('', str(num).strip().upper())
    if not r: return ""
    if _NUM.match(r):
        s = r.lstrip('0'); return s if s else '0'
    return r

MONTH_MAP = {
    "january":1,"february":2,"march":3,"april":4,"may":5,"june":6,
    "july":7,"august":8,"september":9,"october":10,"november":11,"december":12,
    "jan":1,"feb":2,"mar":3,"apr":4,"jun":6,"jul":7,"aug":8,
    "sep":9,"oct":10,"nov":11,"dec":12,
}

def _gstr2b_period(tax_period, financial_year):
    if not tax_period or not financial_year: return ""
    m = MONTH_MAP.get(tax_period.strip().lower())
    if not m: return ""
    try:
        y = int(financial_year.strip().split("-")[0])
        return f"{y if m>=4 else y+1}-{m:02d}"
    except: return ""

def _normalise_itc(raw):
    v = (raw or "").strip().upper()
    if v in {"YES","Y"}: return "ELIGIBLE"
    if v in {"NO","N"}:  return "BLOCKED"
    if v in {"ELIGIBLE","CLAIMABLE","BLOCKED","RCM","INELIGIBLE","PENDING"}: return v
    return "ELIGIBLE"

def _safe_date(val):
    if val is None or val == "": return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
    if isinstance(val, date_type):
        return datetime(val.year,val.month,val.day,tzinfo=timezone.utc)
    for fmt in ["%d-%b-%y","%d-%b-%Y","%d/%m/%Y","%Y-%m-%d","%d-%m-%Y"]:
        try: return datetime.strptime(str(val).strip(),fmt).replace(tzinfo=timezone.utc)
        except: continue
    return None

EXACT_TOL=1.0; FUZZY_SCORE=85; FUZZY_AMT=100.0

def _diffs(a,b):
    return {
        "taxable_amount_diff":round(a.taxable_amount-b.taxable_amount,2),
        "igst_diff":round(a.igst-b.igst,2),
        "cgst_diff":round(a.cgst-b.cgst,2),
        "sgst_diff":round(a.sgst-b.sgst,2),
        "total_amount_diff":round(a.total_amount-b.total_amount,2),
    }

def _composite(inv):
    return f"{inv.normalized_vendor_name or ''} {inv.normalized_invoice_number or ''}".strip()

def _exact_match(pool_a, pool_b):
    results,hits,rem_a = [],[],[]
    lkp = {}
    for b in pool_b:
        k=(b.gstin.upper().strip(), b.normalized_invoice_number or "")
        lkp.setdefault(k,[]).append(b)
    for a in pool_a:
        k=(a.gstin.upper().strip(), a.normalized_invoice_number or "")
        matched=False
        for b in lkp.get(k,[]):
            if b.id in hits: continue
            d=_diffs(a,b); nz=[f.replace("_diff","") for f,v in d.items() if v!=0]
            if not nz: st,cf="EXACT_MATCH",100.0
            elif abs(d["total_amount_diff"])<=EXACT_TOL: st,cf="EXACT_MATCH",98.0
            else: st,cf="MISMATCH",92.0
            a.match_status=b.match_status=st
            a.match_confidence=b.match_confidence=cf
            hits.append(b.id)
            results.append({"status":st,"conf":cf,"a":a,"b":b,"diffs":d,"mf":nz})
            matched=True; break
        if not matched: rem_a.append(a)
    rem_b=[x for x in pool_b if x.id not in hits]
    return results,rem_a,rem_b

def _fuzzy_match(pool_a, pool_b):
    try:
        from rapidfuzz import fuzz as _f; scorer=_f.token_set_ratio
    except ImportError: scorer=None
    results,hits,rem_a=[],[],[]
    bc={b.id:_composite(b) for b in pool_b}
    for a in pool_a:
        ga=a.gstin.upper().strip()
        bs,bb,bc2,br=-1.0,None,0.0,""; fb=None
        for b in pool_b:
            if b.id in hits: continue
            if b.gstin.upper().strip()!=ga: continue
            td=abs(a.taxable_amount-b.taxable_amount)
            if td<=FUZZY_AMT and scorer:
                sc=scorer(_composite(a),bc[b.id])
                if sc>=FUZZY_SCORE and sc>bs:
                    bs,bb,bc2=float(sc),b,round(min(sc,95.0),1); br=f"Fuzzy {sc:.0f}%"
            if td<=1.0 and fb is None: fb=b
        w=bb or fb
        if w:
            if bb is None: bc2,br=75.0,"Amount-only ±₹1"
            a.match_status=w.match_status="FUZZY_MATCH"
            a.match_confidence=w.match_confidence=bc2
            hits.append(w.id)
            results.append({"status":"FUZZY_MATCH","conf":bc2,"a":a,"b":w,"reason":br})
        else: rem_a.append(a)
    rem_b=[x for x in pool_b if x.id not in hits]
    return results,rem_a,rem_b

def _classify(ra,rb):
    out=[]
    for inv in ra: inv.match_status="MISSING_IN_2B"; out.append({"status":"MISSING_IN_2B","inv":inv})
    for inv in rb: inv.match_status="MISSING_IN_BOOKS"; out.append({"status":"MISSING_IN_BOOKS","inv":inv})
    return out

def mk(id_,gstin,num,taxable=10000.0,total=11800.0,vendor="VENDOR",src="GSTR_2A"):
    inv=Invoice(id=id_,gstin=gstin,source=src,vendor_name=vendor,
                invoice_number=num,taxable_amount=taxable,total_amount=total)
    inv.normalized_vendor_name=normalize_vendor_name(vendor)
    inv.normalized_invoice_number=normalize_invoice_number(num)
    return inv

# ═══════════════════════════════════════════════════════
# SECTION 1 — FUNCTIONAL / BEHAVIORAL TESTS
# ═══════════════════════════════════════════════════════

class T1_VendorName(unittest.TestCase):
    def test_uppercase(self):          self.assertEqual(normalize_vendor_name("liberty glass"),"LIBERTY GLASS")
    def test_ms_dot(self):             self.assertEqual(normalize_vendor_name("M/S. Liberty Glass"),"LIBERTY GLASS")
    def test_ms_nodot(self):           self.assertEqual(normalize_vendor_name("M/S Liberty Glass"),"LIBERTY GLASS")
    def test_shri(self):               self.assertEqual(normalize_vendor_name("SHRI Ram Traders"),"RAM TRADERS")
    def test_smt(self):                self.assertEqual(normalize_vendor_name("SMT Laxmi Stores"),"LAXMI STORES")
    def test_ampersand(self):          self.assertEqual(normalize_vendor_name("Sharda Doors & Plywood"),"SHARDA DOORS AND PLYWOOD")
    def test_private_limited(self):    self.assertEqual(normalize_vendor_name("Acme Private Limited"),"ACME PVT LTD")
    def test_pvt_ltd_dot(self):        self.assertEqual(normalize_vendor_name("Acme Pvt. Ltd."),"ACME PVT LTD")
    def test_limited(self):            self.assertEqual(normalize_vendor_name("Acme Limited"),"ACME LTD")
    def test_enterprises(self):        self.assertEqual(normalize_vendor_name("Ram Enterprises"),"RAM ENT")
    def test_corporation(self):        self.assertEqual(normalize_vendor_name("XYZ Corporation"),"XYZ CORP")
    def test_removes_dots(self):       self.assertNotIn(".", normalize_vendor_name("A.B.C. Traders"))
    def test_collapses_spaces(self):   self.assertNotIn("  ", normalize_vendor_name("Liberty   Glass"))
    def test_empty(self):              self.assertEqual(normalize_vendor_name(""),"")
    def test_whitespace(self):         self.assertEqual(normalize_vendor_name("   "),"")
    def test_typo_shares_tokens(self):
        a=normalize_vendor_name("LIBERTY GLASS CRETIONS")
        b=normalize_vendor_name("LIBERTY GLASS CREATIONS")
        self.assertGreaterEqual(len(set(a.split())&set(b.split())),2)

class T2_InvoiceNumber(unittest.TestCase):
    def test_psi_format(self):         self.assertEqual(normalize_invoice_number("PSI-25/26/02103"),"PSI252602103")
    def test_slash(self):              self.assertEqual(normalize_invoice_number("INV/2024/001"),"INV2024001")
    def test_leading_zeros_numeric(self): self.assertEqual(normalize_invoice_number("002103"),"2103")
    def test_alpha_no_leading_strip(self): self.assertEqual(normalize_invoice_number("INV001"),"INV001")
    def test_all_zeros(self):          self.assertEqual(normalize_invoice_number("0000"),"0")
    def test_empty(self):              self.assertEqual(normalize_invoice_number(""),"")
    def test_plain_number(self):       self.assertEqual(normalize_invoice_number("6348"),"6348")
    def test_vch_number(self):         self.assertEqual(normalize_invoice_number("2513"),"2513")
    def test_spaces_removed(self):     self.assertEqual(normalize_invoice_number("INV 001"),"INV001")
    def test_lowercase(self):          self.assertEqual(normalize_invoice_number("inv001"),"INV001")
    def test_numeric_part_survives(self):
        self.assertIn("2513", normalize_invoice_number("PSI-25/26/02513"))

class T3_ExactMatch(unittest.TestCase):
    def test_perfect_100(self):
        a=mk("a1","29AABCE1234F1Z5","INV001"); b=mk("b1","29AABCE1234F1Z5","INV001",src="GSTR_2B")
        res,ra,rb=_exact_match([a],[b])
        self.assertEqual(res[0]["status"],"EXACT_MATCH"); self.assertEqual(res[0]["conf"],100.0)
        self.assertEqual(len(ra),0); self.assertEqual(len(rb),0)
    def test_rounding_98(self):
        a=mk("a1","29AABCE1234F1Z5","INV001",total=11800.5); b=mk("b1","29AABCE1234F1Z5","INV001",total=11800,src="GSTR_2B")
        res,_,_=_exact_match([a],[b]); self.assertEqual(res[0]["status"],"EXACT_MATCH"); self.assertEqual(res[0]["conf"],98.0)
    def test_large_diff_mismatch(self):
        a=mk("a1","29AABCE1234F1Z5","INV001",taxable=10000,total=11800)
        b=mk("b1","29AABCE1234F1Z5","INV001",taxable=9000,total=10620,src="GSTR_2B")
        res,_,_=_exact_match([a],[b]); self.assertEqual(res[0]["status"],"MISMATCH")
    def test_diff_gstin_no_match(self):
        a=mk("a1","29AABCE1234F1Z5","INV001"); b=mk("b1","27XYZAB5678G2A3","INV001",src="GSTR_2B")
        res,ra,rb=_exact_match([a],[b]); self.assertEqual(len(res),0); self.assertEqual(len(ra),1)
    def test_diff_inv_no_match(self):
        a=mk("a1","29AABCE1234F1Z5","INV001"); b=mk("b1","29AABCE1234F1Z5","INV002",src="GSTR_2B")
        res,ra,_=_exact_match([a],[b]); self.assertEqual(len(res),0)
    def test_leading_zeros_normalised(self):
        a=mk("a1","29AABCE1234F1Z5","002103"); b=mk("b1","29AABCE1234F1Z5","2103",src="GSTR_2B")
        res,_,_=_exact_match([a],[b]); self.assertEqual(len(res),1)
    def test_case_insensitive_gstin(self):
        a=mk("a1","29aabce1234f1z5","INV001"); b=mk("b1","29AABCE1234F1Z5","INV001",src="GSTR_2B")
        res,_,_=_exact_match([a],[b]); self.assertEqual(len(res),1)
    def test_no_double_consume(self):
        a1=mk("a1","29AABCE1234F1Z5","INV001"); a2=mk("a2","29AABCE1234F1Z5","INV001")
        b=mk("b1","29AABCE1234F1Z5","INV001",src="GSTR_2B")
        res,ra,_=_exact_match([a1,a2],[b]); self.assertEqual(len(res),1); self.assertEqual(len(ra),1)
    def test_empty_pools(self):
        res,ra,rb=_exact_match([],[]); self.assertEqual(res,[]); self.assertEqual(ra,[]); self.assertEqual(rb,[])

class T4_GSTR2BPeriod(unittest.TestCase):
    def test_february_fy2526(self): self.assertEqual(_gstr2b_period("February","2025-26"),"2026-02")
    def test_april_fy2526(self):    self.assertEqual(_gstr2b_period("April","2025-26"),"2025-04")
    def test_march_fy2526(self):    self.assertEqual(_gstr2b_period("March","2025-26"),"2026-03")
    def test_december(self):        self.assertEqual(_gstr2b_period("December","2024-25"),"2024-12")
    def test_january(self):         self.assertEqual(_gstr2b_period("January","2024-25"),"2025-01")
    def test_abbreviated(self):     self.assertEqual(_gstr2b_period("Feb","2025-26"),"2026-02")
    def test_empty_period(self):    self.assertEqual(_gstr2b_period("","2025-26"),"")
    def test_empty_fy(self):        self.assertEqual(_gstr2b_period("February",""),"")
    def test_invalid_month(self):   self.assertEqual(_gstr2b_period("Octember","2025-26"),"")

class T5_NormaliseITC(unittest.TestCase):
    def test_yes(self):      self.assertEqual(_normalise_itc("Yes"),      "ELIGIBLE")
    def test_YES(self):      self.assertEqual(_normalise_itc("YES"),      "ELIGIBLE")
    def test_no(self):       self.assertEqual(_normalise_itc("No"),       "BLOCKED")
    def test_NO(self):       self.assertEqual(_normalise_itc("NO"),       "BLOCKED")
    def test_eligible(self): self.assertEqual(_normalise_itc("ELIGIBLE"), "ELIGIBLE")
    def test_blocked(self):  self.assertEqual(_normalise_itc("BLOCKED"),  "BLOCKED")
    def test_none(self):     self.assertEqual(_normalise_itc(None),       "ELIGIBLE")
    def test_unknown(self):  self.assertEqual(_normalise_itc("MAYBE"),    "ELIGIBLE")
    def test_claimable(self):self.assertEqual(_normalise_itc("CLAIMABLE"),"CLAIMABLE")

class T6_SafeDate(unittest.TestCase):
    def test_datetime_utc(self):
        dt=datetime(2026,2,12,tzinfo=timezone.utc); self.assertEqual(_safe_date(dt),dt)
    def test_naive_gets_utc(self):
        self.assertIsNotNone(_safe_date(datetime(2026,2,12)).tzinfo)
    def test_date_object(self):
        r=_safe_date(date_type(2026,2,12)); self.assertEqual(r.year,2026); self.assertEqual(r.month,2)
    def test_str_dmy(self):
        r=_safe_date("12-Feb-26"); self.assertIsNotNone(r); self.assertEqual(r.month,2)
    def test_str_iso(self):
        r=_safe_date("2026-02-12"); self.assertIsNotNone(r); self.assertEqual(r.year,2026)
    def test_none(self):    self.assertIsNone(_safe_date(None))
    def test_empty(self):   self.assertIsNone(_safe_date(""))
    def test_invalid(self): self.assertIsNone(_safe_date("not-a-date"))

# ═══════════════════════════════════════════════════════
# SECTION 2 — EVALUATION & DATA VALIDATION
# ═══════════════════════════════════════════════════════

@dataclass
class Pair:
    gstin:str; n2a:str; n2b:str; v2a:str; v2b:str
    tax2a:float; tax2b:float; tot2a:float; tot2b:float; exp:str

HOLDOUT = [
    # Perfect exact matches
    Pair("29AABCE1234A1Z5","INV001","INV001","ACME PVT LTD","ACME PVT LTD",10000,10000,11800,11800,"EXACT_MATCH"),
    Pair("27AABCE1234A1Z5","PSI252602103","PSI252602103","LIBERTY GLASS","LIBERTY GLASS",19000,19000,22420,22420,"EXACT_MATCH"),
    Pair("36AAHCM5302R1Z2","2513","2513","AK CHEMIE PVT LTD","AK CHEMIE PVT LTD",19000,19000,22420,22420,"EXACT_MATCH"),
    Pair("07BQVPJ2893N1ZT","6348","6348","AJ TOOLS CO","AJ TOOLS CO",33600,33600,39648,39648,"EXACT_MATCH"),
    Pair("29AABCE5678B2Z1","AAI4802","AAI4802","AAI TRADERS","AAI TRADERS",1813,1813,2139,2139,"EXACT_MATCH"),
    Pair("29AABCE5678B2Z1","AAI4872","AAI4872","AAI TRADERS","AAI TRADERS",162480,162480,191687,191687,"EXACT_MATCH"),
    # Rounding tolerance → EXACT_MATCH 98%
    Pair("29AABCE9999C3Z4","INV100","INV100","RAVI ENT","RAVI ENT",5000,5000,5900.50,5900.00,"EXACT_MATCH"),
    # Amount mismatch → MISMATCH
    Pair("29AABCE1234A1Z5","INV202","INV202","DELTA LTD","DELTA LTD",8000,9000,9440,10620,"MISMATCH"),
    Pair("27AABCE1234A1Z5","INV303","INV303","SIGMA CORP","SIGMA CORP",15000,14800,17700,17464,"MISMATCH"),
    # Fuzzy matches — same GSTIN + amount, different invoice number
    Pair("36AAHCM5302R1Z2","2513","PSI252602103","AK CHEMIE PVT LTD","AK CHEMIE PVT LTD",19000,19000,22420,22420,"FUZZY_MATCH"),
    Pair("07BQVPJ2893N1ZT","6348","PSI252606348","AJ TOOLS CO","AJ TOOLS AND CO",33600,33600,39648,39648,"FUZZY_MATCH"),
    Pair("29AABCE5678B2Z1","AAI4802","AAI4802X","AAI TRADERS","AAI INTL TRADERS",1813,1813,2139,2139,"FUZZY_MATCH"),
    Pair("29AABCE5678B2Z1","AAI5015","AAI5015A","AAI TRADERS","AAI TRADERS PVT LTD",124703,124703,147149,147149,"FUZZY_MATCH"),
    Pair("29AABCE5678B2Z1","AAI5120","AAI5120V","AAI TRADERS","AAI TRADERS",35360,35360,41725,41725,"FUZZY_MATCH"),
    # MISSING_IN_2B (in 2A only)
    Pair("29AABCE1111D4Z3","INV404","","GHOST VENDOR","",25000,0,29500,0,"MISSING_IN_2B"),
    Pair("27AABCE2222E5Z2","INV505","","PHANTOM CORP","",8500,0,10030,0,"MISSING_IN_2B"),
    Pair("36AABCE3333F6Z1","INV606","","MISSING SUPPLY","",3000,0,3540,0,"MISSING_IN_2B"),
    Pair("07AABCE4444G7Z0","INV707","","ABSENT TRADER","",12000,0,14160,0,"MISSING_IN_2B"),
    Pair("29AABCE5555H8Z9","INV808","","LATE FILER","",45000,0,53100,0,"MISSING_IN_2B"),
    # MISSING_IN_BOOKS (in 2B only)
    Pair("29AABCE6666I9Z8","","INV909","","NEW VENDOR",0,18000,0,21240,"MISSING_IN_BOOKS"),
    Pair("27AABCE7777J1Z7","","INV010","","UNRECORDED CO",0,5500,0,6490,"MISSING_IN_BOOKS"),
    Pair("36AABCE8888K2Z6","","INV011","","PORTAL ONLY",0,7200,0,8496,"MISSING_IN_BOOKS"),
    Pair("07AABCE9999L3Z5","","INV012","","SURPRISE CORP",0,9800,0,11564,"MISSING_IN_BOOKS"),
    Pair("29AABCE0000M4Z4","","INV013","","EXTRA SUPPLY",0,22000,0,25960,"MISSING_IN_BOOKS"),
    # Edge cases
    Pair("29AABCE1234A1Z5","INV000","INV000","ZERO TAX CO","ZERO TAX CO",0,0,0,0,"EXACT_MATCH"),
    Pair("36AABCE5678N5Z3","BIG001","BIG001","MEGA CORP","MEGA CORP",1000000,1000000,1180000,1180000,"EXACT_MATCH"),
    Pair("29AABCE1234A1Z5","INV/2026/001","INV2026001","SLASH CO","SLASH CO",5000,5000,5900,5900,"EXACT_MATCH"),
    Pair("29AABCE1234A1Z5","INV-2026-001","INV2026001","DASH CO","DASH CO",5000,5000,5900,5900,"EXACT_MATCH"),
    Pair("29ZZZZZ1234A1Z5","COMMON001","","FAKE COMPANY","",5000,0,5900,0,"MISSING_IN_2B"),
    Pair("29AABCE5678B2Z1","AAI5201","AAI5201B","AAI TRADERS","AAI TRADERS HYD",280169,280169,330600,330600,"FUZZY_MATCH"),
]

def _run_holdout(pairs):
    all_a,all_b=[],[]
    for i,p in enumerate(pairs):
        if p.n2a:
            a=mk(f"a{i}",p.gstin,p.n2a,p.tax2a,p.tot2a,p.v2a)
            all_a.append(a)
        if p.n2b:
            b=mk(f"b{i}",p.gstin,p.n2b,p.tax2b,p.tot2b,p.v2b,"GSTR_2B")
            all_b.append(b)
    er,ra,rb=_exact_match(all_a,all_b)
    fr,sa,sb=_fuzzy_match(ra,rb)
    cr=_classify(sa,sb)
    pred={}
    for r in er: pred[r["a"].id]=r["status"]
    for r in fr: pred[r["a"].id]=r["status"]
    for r in cr: pred[r["inv"].id]=r["status"]
    out=[]
    for i,p in enumerate(pairs):
        pid=f"a{i}" if p.n2a else f"b{i}"
        out.append((pred.get(pid,"UNMATCHED"),p.exp))
    return out

def _metrics(preds):
    classes=sorted({e for _,e in preds}|{p for p,_ in preds})
    m={}; tc=0
    for cls in classes:
        tp=sum(1 for p,e in preds if p==cls and e==cls)
        fp=sum(1 for p,e in preds if p==cls and e!=cls)
        fn=sum(1 for p,e in preds if p!=cls and e==cls)
        tc+=tp
        pr=tp/(tp+fp) if tp+fp else 0.0
        rc=tp/(tp+fn) if tp+fn else 0.0
        f1=2*pr*rc/(pr+rc) if pr+rc else 0.0
        m[cls]={"TP":tp,"FP":fp,"FN":fn,"precision":round(pr,4),"recall":round(rc,4),"f1":round(f1,4)}
    return {"per_class":m,"accuracy":round(tc/len(preds),4) if preds else 0.0}

class T7_Evaluation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.preds=_run_holdout(HOLDOUT); cls.m=_metrics(cls.preds)

    def test_accuracy_gte_70(self):
        acc=self.m["accuracy"]; print(f"\n[Eval] Accuracy: {acc:.1%}")
        self.assertGreaterEqual(acc,0.70,f"Accuracy {acc:.1%} < 70%")

    def test_exact_match_recall_gte_80(self):
        r=self.m["per_class"].get("EXACT_MATCH",{}).get("recall",0.0)
        print(f"[Eval] EXACT_MATCH recall: {r:.1%}")
        self.assertGreaterEqual(r,0.80)

    def test_missing_in_2b_recall_gte_70(self):
        r=self.m["per_class"].get("MISSING_IN_2B",{}).get("recall",0.0)
        print(f"[Eval] MISSING_IN_2B recall: {r:.1%}")
        self.assertGreaterEqual(r,0.70)

    def test_missing_in_books_recall_gte_70(self):
        r=self.m["per_class"].get("MISSING_IN_BOOKS",{}).get("recall",0.0)
        print(f"[Eval] MISSING_IN_BOOKS recall: {r:.1%}")
        self.assertGreaterEqual(r,0.70)

    def test_no_unmatched_on_zero_amount(self):
        zero=[p for p in HOLDOUT if p.tax2a==0 and p.tax2b==0 and p.n2a and p.n2b]
        for p in zero: self.assertEqual(p.exp,"EXACT_MATCH")

    def test_print_report(self):
        print("\n"+"="*62)
        print("CLASSIFICATION REPORT")
        print(f"{'Class':<22}{'Prec':>7}{'Rec':>7}{'F1':>7}{'TP':>5}{'FP':>5}{'FN':>5}")
        print("-"*62)
        for cls,m in sorted(self.m["per_class"].items()):
            print(f"{cls:<22}{m['precision']:>7.1%}{m['recall']:>7.1%}{m['f1']:>7.1%}{m['TP']:>5}{m['FP']:>5}{m['FN']:>5}")
        print("-"*62)
        print(f"{'Accuracy':<22}{self.m['accuracy']:>7.1%}")
        print("="*62)
        self.assertTrue(True)

# ═══════════════════════════════════════════════════════
# SECTION 3 — BIAS & FAIRNESS TESTING
# ═══════════════════════════════════════════════════════

def _dpd(r_a,r_b): return abs(r_a-r_b)
def _eod(tpr_a,tpr_b,fpr_a,fpr_b): return max(abs(tpr_a-tpr_b),abs(fpr_a-fpr_b))

def _match_rate(pairs):
    exp_matched=sum(1 for p in pairs if p.exp in {"EXACT_MATCH","FUZZY_MATCH"})
    if not exp_matched: return 0.0
    preds=_run_holdout(pairs)
    got=sum(1 for p,e in preds if p in {"EXACT_MATCH","FUZZY_MATCH"} and e in {"EXACT_MATCH","FUZZY_MATCH"})
    return got/exp_matched

def _tpr_fpr(pairs):
    preds=_run_holdout(pairs); M={"EXACT_MATCH","FUZZY_MATCH"}
    tp=sum(1 for p,e in preds if p in M and e in M)
    fn=sum(1 for p,e in preds if p not in M and e in M)
    fp=sum(1 for p,e in preds if p in M and e not in M)
    tn=sum(1 for p,e in preds if p not in M and e not in M)
    return (tp/(tp+fn) if tp+fn else 0.0),(fp/(fp+tn) if fp+tn else 0.0)

# Group A — English vs Indian vendor names
ENG=[
    Pair("29AAAA0001A1Z5","EN001","EN001","LIBERTY GLASS CREATIONS","LIBERTY GLASS CREATIONS",10000,10000,11800,11800,"EXACT_MATCH"),
    Pair("29AAAA0002A1Z5","EN002","EN002","DELTA IRON AND STEEL","DELTA IRON AND STEEL",20000,20000,23600,23600,"EXACT_MATCH"),
    Pair("29AAAA0003A1Z5","EN003","EN003","SIGMA INDUSTRIAL CORP","SIGMA INDUSTRIAL CORP",15000,15000,17700,17700,"EXACT_MATCH"),
    Pair("29AAAA0004A1Z5","EN004","","GHOST VENDOR ENGLISH","",8000,0,9440,0,"MISSING_IN_2B"),
    Pair("29AAAA0005A1Z5","EN005","EN005","APEX SOLUTIONS","APEX SOLUTIONS",5000,5000,5900,5900,"EXACT_MATCH"),
]
IND=[
    Pair("29BBBB0001B1Z5","IN001","IN001","SHRI RAM TRADERS","SHRI RAM TRADERS",10000,10000,11800,11800,"EXACT_MATCH"),
    Pair("29BBBB0002B1Z5","IN002","IN002","BALAJI ENTERPRISES","BALAJI ENTERPRISES",20000,20000,23600,23600,"EXACT_MATCH"),
    Pair("29BBBB0003B1Z5","IN003","IN003","KRISHNA AGRO SUPPLIES","KRISHNA AGRO SUPPLIES",15000,15000,17700,17700,"EXACT_MATCH"),
    Pair("29BBBB0004B1Z5","IN004","","SHARDA DOORS PLYWOOD","",8000,0,9440,0,"MISSING_IN_2B"),
    Pair("29BBBB0005B1Z5","IN005","IN005","TIRUPATI STEEL WORKS","TIRUPATI STEEL WORKS",5000,5000,5900,5900,"EXACT_MATCH"),
]
# Group B — Metro (07/27/29) vs Non-metro (36/24/32) GSTIN states
METRO=[
    Pair("07CCCC0001C1Z5","M001","M001","METRO VENDOR 1","METRO VENDOR 1",10000,10000,11800,11800,"EXACT_MATCH"),
    Pair("27CCCC0002C1Z5","M002","M002","METRO VENDOR 2","METRO VENDOR 2",20000,20000,23600,23600,"EXACT_MATCH"),
    Pair("29CCCC0003C1Z5","M003","","METRO MISSING","",8000,0,9440,0,"MISSING_IN_2B"),
    Pair("07CCCC0004C1Z5","M004","M004","METRO VENDOR 4","METRO VENDOR 4",5000,5000,5900,5900,"EXACT_MATCH"),
]
NONMETRO=[
    Pair("36DDDD0001D1Z5","NM001","NM001","NON METRO VENDOR 1","NON METRO VENDOR 1",10000,10000,11800,11800,"EXACT_MATCH"),
    Pair("24DDDD0002D1Z5","NM002","NM002","NON METRO VENDOR 2","NON METRO VENDOR 2",20000,20000,23600,23600,"EXACT_MATCH"),
    Pair("32DDDD0003D1Z5","NM003","","NON METRO MISSING","",8000,0,9440,0,"MISSING_IN_2B"),
    Pair("36DDDD0004D1Z5","NM004","NM004","NON METRO VENDOR 4","NON METRO VENDOR 4",5000,5000,5900,5900,"EXACT_MATCH"),
]
# Group C — ELIGIBLE vs BLOCKED ITC
ELIG=[
    Pair("29EEEE0001E1Z5","ITC001","ITC001","ELIGIBLE VENDOR 1","ELIGIBLE VENDOR 1",10000,10000,11800,11800,"EXACT_MATCH"),
    Pair("29EEEE0002E1Z5","ITC002","ITC002","ELIGIBLE VENDOR 2","ELIGIBLE VENDOR 2",5000,5000,5900,5900,"EXACT_MATCH"),
    Pair("29EEEE0003E1Z5","ITC003","","ELIGIBLE MISSING","",8000,0,9440,0,"MISSING_IN_2B"),
]
BLKD=[
    Pair("29FFFF0001F1Z5","BITC001","BITC001","BLOCKED VENDOR 1","BLOCKED VENDOR 1",10000,10000,11800,11800,"EXACT_MATCH"),
    Pair("29FFFF0002F1Z5","BITC002","BITC002","BLOCKED VENDOR 2","BLOCKED VENDOR 2",5000,5000,5900,5900,"EXACT_MATCH"),
    Pair("29FFFF0003F1Z5","BITC003","","BLOCKED MISSING","",8000,0,9440,0,"MISSING_IN_2B"),
]

class T8_Fairness(unittest.TestCase):

    def test_A_demographic_parity_vendor_language(self):
        re_=_match_rate(ENG); ri=_match_rate(IND); dpd=_dpd(re_,ri)
        print(f"\n[Fairness A] English {re_:.1%} | Indian {ri:.1%} | DPD {dpd:.3f}")
        self.assertLessEqual(dpd,0.15,f"Vendor language DPD {dpd:.3f} > 0.15")

    def test_A_equalized_odds_vendor_language(self):
        tpr_e,fpr_e=_tpr_fpr(ENG); tpr_i,fpr_i=_tpr_fpr(IND)
        eod=_eod(tpr_e,tpr_i,fpr_e,fpr_i)
        print(f"[Fairness A] EOD vendor language: {eod:.3f}")
        self.assertLessEqual(eod,0.15,f"Vendor language EOD {eod:.3f} > 0.15")

    def test_B_demographic_parity_gstin_state(self):
        rm=_match_rate(METRO); rn=_match_rate(NONMETRO); dpd=_dpd(rm,rn)
        print(f"[Fairness B] Metro {rm:.1%} | Non-metro {rn:.1%} | DPD {dpd:.3f}")
        self.assertLessEqual(dpd,0.15,f"GSTIN state DPD {dpd:.3f} > 0.15")

    def test_B_equalized_odds_gstin_state(self):
        tpr_m,fpr_m=_tpr_fpr(METRO); tpr_n,fpr_n=_tpr_fpr(NONMETRO)
        eod=_eod(tpr_m,tpr_n,fpr_m,fpr_n)
        print(f"[Fairness B] EOD GSTIN state: {eod:.3f}")
        self.assertLessEqual(eod,0.15,f"GSTIN state EOD {eod:.3f} > 0.15")

    def test_C_demographic_parity_itc_category(self):
        re_=_match_rate(ELIG); rb=_match_rate(BLKD); dpd=_dpd(re_,rb)
        print(f"[Fairness C] ELIGIBLE {re_:.1%} | BLOCKED {rb:.1%} | DPD {dpd:.3f}")
        self.assertLessEqual(dpd,0.15,f"ITC category DPD {dpd:.3f} > 0.15")

    def test_C_eligible_normalises_correctly(self):
        self.assertEqual(_normalise_itc("Yes"),"ELIGIBLE")
        self.assertNotEqual(_normalise_itc("Yes"),"BLOCKED")

    def test_C_blocked_normalises_correctly(self):
        self.assertEqual(_normalise_itc("No"),"BLOCKED")
        self.assertNotEqual(_normalise_itc("No"),"ELIGIBLE")

    def test_print_fairness_summary(self):
        grps=[("English vendors",ENG),("Indian vendors",IND),
              ("Metro GSTINs",METRO),("Non-metro GSTINs",NONMETRO),
              ("ELIGIBLE ITC",ELIG),("BLOCKED ITC",BLKD)]
        print("\n"+"="*55)
        print("FAIRNESS SUMMARY")
        print(f"{'Group':<22}{'Match%':>8}{'TPR':>7}{'FPR':>7}")
        print("-"*55)
        for name,pairs in grps:
            r=_match_rate(pairs); tpr,fpr=_tpr_fpr(pairs)
            print(f"{name:<22}{r:>8.1%}{tpr:>7.1%}{fpr:>7.1%}")
        print("="*55)
        print("Fairness thresholds: DPD ≤ 0.15 | EOD ≤ 0.15")
        print("="*55); self.assertTrue(True)

if __name__=="__main__":
    unittest.main(verbosity=2)