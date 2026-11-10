import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

os.makedirs("workspace/public", exist_ok=True)
os.makedirs("apps/public", exist_ok=True)
os.makedirs("apps/dist", exist_ok=True)

def sync_asset(filename, img):
    for folder in ["workspace/public", "apps/public", "apps/dist"]:
        path = os.path.join(folder, filename)
        img.save(path, quality=92)
    print(f"Synced: {filename}")

# 1. img_court_trial_1952.jpg - British Crown Court 1952 Indictment Document
img1 = Image.new("RGB", (900, 1100), "#EFE8DA")
d1 = ImageDraw.Draw(img1)
# Aged paper grid lines & border
d1.rectangle([(30, 30), (870, 1070)], outline="#A89F8E", width=3)
d1.rectangle([(38, 38), (862, 1062)], outline="#C5BCAE", width=1)
# Header
d1.rectangle([(30, 30), (870, 120)], fill="#241E19")
d1.text((160, 52), "CHESHIRE QUARTER SESSIONS // MARCH 1952", fill="#F5F0E4")
d1.text((220, 80), "OFFICIAL CROWN INDICTMENT — CASE NO. 1952/T-41", fill="#D97706")
# Body text
lines = [
    "IN THE MATTER OF: THE CROWN vs. ALAN MATHISON TURING",
    "AGE: 39 YEARS // OCCUPATION: MATHEMATICIAN & CRYPTANALYST",
    "----------------------------------------------------------------",
    "CHARGE: Gross Indecency contrary to Section 11 of Criminal Law.",
    "PLEA: Guilty as charged at Knutsford Sessions on 31 March 1952.",
    "",
    "COURT ORDER & SENTENCE:",
    "Defendant is placed on probation for twelve calendar months,",
    "subject to submission to Organo-Therapy (Chemical Castration)",
    "under the supervision of St. Mary's Hospital, Manchester.",
    "",
    "STATUS: ROYAL SECURITY CLEARANCE REVOKED IMMEDIATELY.",
    "ALL ACCESS TO GCHQ AND COMPUTING FACILITIES BARRED.",
    "----------------------------------------------------------------",
    "SIGNATURE: [RECORDED IN CLERK'S REGISTER - CHESHIRE, 1952]"
]
y = 160
for l in lines:
    d1.text((60, y), l, fill="#181410")
    y += 42

# Red wax seal & Classified stamp
d1.ellipse([(640, 780), (820, 960)], outline="#DC2626", width=5)
d1.text((665, 830), "CONVICTED", fill="#DC2626")
d1.text((680, 875), "MARCH 1952", fill="#DC2626")
# Texture blur/noise
img1 = img1.filter(ImageFilter.GaussianBlur(0.4))
sync_asset("img_court_trial_1952.jpg", img1)

# 2. img_europe_battle_map.jpg - WWII European Naval War Map
img2 = Image.new("RGB", (1000, 800), "#1C242B")
d2 = ImageDraw.Draw(img2)
# Grid lines
for x in range(0, 1000, 80):
    d2.line([(x, 0), (x, 800)], fill="#26343F", width=1)
for y in range(0, 800, 80):
    d2.line([(0, y), (1000, y)], fill="#26343F", width=1)
# Header
d2.rectangle([(0, 0), (1000, 70)], fill="#0E161C")
d2.text((50, 22), "NORTH ATLANTIC CONVOY ROUTE // GERMAN U-BOOT PATROL ZONES 1942", fill="#E2E8F0")
# War zones
d2.rectangle([(120, 160), (450, 680)], outline="#DC2626", width=3)
d2.text((140, 180), "GRID 42-ALPHA: 14 ALLIED VESSELS SUNK", fill="#DC2626")
d2.line([(180, 300), (380, 520)], fill="#EF4444", width=3)
d2.line([(240, 420), (600, 360)], fill="#EF4444", width=3)
# Bletchley Park marker
d2.ellipse([(620, 260), (670, 310)], fill="#F59E0B", outline="#FFFFFF", width=2)
d2.text((685, 275), "BLETCHLEY PARK (STATION X)", fill="#F59E0B")
# Red classification
d2.rectangle([(700, 680), (960, 760)], outline="#DC2626", width=4)
d2.text((720, 710), "TOP SECRET // ULTRA", fill="#DC2626")
img2 = img2.filter(ImageFilter.GaussianBlur(0.3))
sync_asset("img_europe_battle_map.jpg", img2)

# 3. img_naval_cipher_telegram.jpg - Intercepted Kriegmarine Enigma Telegram
img3 = Image.new("RGB", (900, 1100), "#E6DFD1")
d3 = ImageDraw.Draw(img3)
d3.rectangle([(25, 25), (875, 1075)], outline="#B0A695", width=2)
d3.rectangle([(25, 25), (875, 110)], fill="#2E2822")
d3.text((80, 50), "KRIEGSMARINE OBERKOMMANDO // GEHEIME KOMMANDOSACHE", fill="#F5F0E4")
# Typewriter coded blocks
ciphers = [
    "STATION: U-FLOTTE 7 // DATUM: 14. OKTOBER 1942",
    "SCHLUESSEL: ENIGMA M4 (TRITON 4-ROTOR CIPHER)",
    "----------------------------------------------------------",
    "TLKQB  XPMRZ  WVKJN  OPLMA  ZXCVB  QWERT  YUIOP",
    "HGFDS  BNMAS  DFGHJ  KLPOI  UYTRE  WQCXZ  MNBVC",
    "POIUY  TREWQ  ASDFG  HJKLZ  XCVBN  MLKJI  HGFED",
    "QAZWS  XEDCR  FVTGB  YHNUJ  MIKOL  PQAZW  SXEDC",
    "",
    "DECRYPTED BY BLETCHLEY PARK (HUT 8 // A. TURING):",
    "-> ATTACK PLANNED AT 0300 HRS ON CONVOY HX-212",
    "-> ALTER COURSE 14 DEGREES NORTH-WEST",
    "----------------------------------------------------------",
    "ALLIED ACTION: CONVOY SAVED // CASUALTIES PREVENTED."
]
y = 150
for c in ciphers:
    color = "#181410" if not c.startswith("->") else "#B91C1C"
    d3.text((60, y), c, fill=color)
    y += 45
# Stamp
d3.rectangle([(550, 750), (820, 830)], outline="#059669", width=4)
d3.text((580, 780), "DECRYPTED: SUCCESS", fill="#059669")
sync_asset("img_naval_cipher_telegram.jpg", img3)

# 4. img_modern_supercomputer.jpg - Modern AI Neural Matrix
img4 = Image.new("RGB", (1000, 1000), "#080B11")
d4 = ImageDraw.Draw(img4)
# Glowing neural lines
for i in range(12):
    y = 80 + i * 75
    d4.line([(50, y), (950, y)], fill="#0E1B2E", width=2)
d4.text((80, 60), "TURING COMPUTABILITY -> 21ST CENTURY ARTIFICIAL INTELLIGENCE", fill="#06B6D4")
d4.text((80, 95), "1950 TURING TEST // 2026 LARGE LANGUAGE MODELS & NEURAL ARCHITECTURE", fill="#64748B")
# Node clusters
nodes = [(250, 300), (500, 220), (750, 300), (350, 500), (650, 500), (500, 700), (250, 800), (750, 800)]
for n in nodes:
    d4.ellipse([(n[0]-25, n[1]-25), (n[0]+25, n[1]+25)], fill="#0284C7", outline="#38BDF8", width=3)
    d4.ellipse([(n[0]-10, n[1]-10), (n[0]+10, n[1]+10)], fill="#FFFFFF")
for i in range(len(nodes)-1):
    d4.line([nodes[i], nodes[i+1]], fill="#0284C7", width=2)
d4.line([nodes[0], nodes[4]], fill="#06B6D4", width=2)
d4.line([nodes[2], nodes[3]], fill="#06B6D4", width=2)
d4.line([nodes[1], nodes[5]], fill="#38BDF8", width=3)

d4.text((320, 920), "HIS IDEAS BUILT OUR MODERN WORLD", fill="#F59E0B")
sync_asset("img_modern_supercomputer.jpg", img4)
print("All archival assets successfully generated and synced!")

