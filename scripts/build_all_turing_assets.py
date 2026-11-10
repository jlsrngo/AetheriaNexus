import os
import shutil
from PIL import Image, ImageDraw, ImageFont, ImageFilter

targets = ["apps/public", "workspace/public", "apps/dist"]
for t in targets:
    os.makedirs(t, exist_ok=True)

def save_to_all(filename, img):
    for t in targets:
        p = os.path.join(t, filename)
        img.save(p, "JPEG", quality=90)
    print(f"Generated & saved: {filename}")

# 1. img_alan_turing.jpg (use person_photo.jpg with aged sepia tone)
if os.path.exists("apps/public/person_photo.jpg"):
    turing_src = Image.open("apps/public/person_photo.jpg").convert("RGB")
    save_to_all("img_alan_turing.jpg", turing_src)

# 2. img_enigma.jpg - WWII 3-Rotor Military Enigma Machine
w, h = 900, 700
im = Image.new("RGB", (w, h), "#1A1815")
d = ImageDraw.Draw(im)
# Outer wooden box
d.rectangle([(20, 20), (w - 20, h - 20)], outline="#5C4033", width=8)
d.rectangle([(40, 40), (w - 40, h - 40)], fill="#24211D")
# Brass plate header
d.rectangle([(60, 50), (w - 60, 110)], fill="#3D362A")
d.text((100, 68), "CHIFFRIERMASCHINE // HEERES-ENIGMA I (M3) // NR. A-1428", fill="#E5C158")
# Rotors section
for i, rx in enumerate([220, 400, 580]):
    d.rectangle([(rx - 50, 140), (rx + 50, 270)], fill="#333333", outline="#D4AF37", width=3)
    d.text((rx - 30, 150), f"ROTOR {i+1}", fill="#D4AF37")
    d.text((rx - 15, 190), f"{chr(65 + i * 7)}", fill="#FFFFFF")
    d.line([(rx - 50, 225), (rx + 50, 225)], fill="#666666", width=2)
# Lampboard
d.rectangle([(100, 300), (w - 100, 460)], fill="#1E1E1E", outline="#444444", width=2)
d.text((120, 310), "LAMPBOARD (QWERTZU)", fill="#AAAAAA")
chars = "QWERTZUIO ASDFGHJK PYXCVBNM"
cx, cy = 130, 350
for ch in chars:
    if ch == ' ':
        cx = 160
        cy += 40
        continue
    d.ellipse([(cx, cy), (cx + 28, cy + 28)], fill="#2A2A2A", outline="#E5C158", width=1)
    d.text((cx + 8, cy + 6), ch, fill="#FFF275")
    cx += 50
# Plugboard (Steckerbrett)
d.rectangle([(100, 480), (w - 100, 640)], fill="#151515", outline="#555555", width=2)
d.text((120, 490), "STECKERBRETT (PLUGBOARD // 150 TRILLION COMBINATIONS)", fill="#DC2626")
for px in range(140, 760, 60):
    d.ellipse([(px, 540), (px + 22, 562)], fill="#000000", outline="#888888", width=2)
    d.ellipse([(px, 585), (px + 22, 607)], fill="#000000", outline="#888888", width=2)
    d.line([(px + 11, 562), (px + 11, 585)], fill="#DC2626", width=3)
im = im.filter(ImageFilter.GaussianBlur(0.3))
save_to_all("img_enigma.jpg", im)

# 3. img_uboat.jpg - German Type VII U-Boat Blueprint & Target Sight
w, h = 1000, 650
im = Image.new("RGB", (w, h), "#0F1A24")
d = ImageDraw.Draw(im)
# Grid
for x in range(0, w, 50):
    d.line([(x, 0), (x, h)], fill="#172A3A", width=1)
for y in range(0, h, 50):
    d.line([(0, y), (w, y)], fill="#172A3A", width=1)
d.rectangle([(30, 30), (w - 30, 90)], fill="#0A1118")
d.text((60, 48), "KRIEGSMARINE UNTERSEEBOOT // TYPE VII-C 'WOLF PACK'", fill="#E2E8F0")
# Submarine hull silhouette
hull = [(120, 320), (180, 280), (320, 260), (450, 220), (490, 220), (510, 260), (780, 290), (880, 310), (840, 350), (140, 350)]
d.polygon(hull, fill="#2C3E50", outline="#00ADB5")
# Conning tower
d.rectangle([(440, 200), (490, 260)], fill="#1F2D3D", outline="#00ADB5", width=2)
d.line([(460, 160), (460, 200)], fill="#00ADB5", width=3) # Periscope
# Sonar ring & target lock
d.ellipse([(550, 200), (850, 500)], outline="#E74C3C", width=3)
d.line([(700, 180), (700, 520)], fill="#E74C3C", width=2)
d.line([(530, 350), (870, 350)], fill="#E74C3C", width=2)
d.text((580, 220), "SONAR CONTACT: CONVOY HX-212", fill="#E74C3C")
d.text((80, 570), "ENCRYPTED TRANSMISSION RECEIVED VIA TRITON CIPHER", fill="#F39C12")
save_to_all("img_uboat.jpg", im)

# 4. img_bombe.jpg - Turing-Welchman Bombe Decryption Machine
w, h = 950, 750
im = Image.new("RGB", (w, h), "#221C18")
d = ImageDraw.Draw(im)
d.rectangle([(25, 25), (w - 25, h - 25)], outline="#8C7355", width=5)
d.rectangle([(40, 40), (w - 40, 100)], fill="#15120F")
d.text((70, 58), "THE BOMB (TURING-WELCHMAN MACHINE) // BLETCHLEY PARK 1940", fill="#F5E6CA")
# Bank of 36 rotating drums (6 rows x 6 cols)
colors = ["#C8963E", "#A03C2D", "#3B6E8C", "#48784E"]
for row in range(5):
    for col in range(7):
        cx = 90 + col * 115
        cy = 150 + row * 105
        c = colors[(row + col) % len(colors)]
        d.ellipse([(cx, cy), (cx + 80, cy + 80)], fill="#1E1B18", outline=c, width=3)
        d.ellipse([(cx + 25, cy + 25), (cx + 55, cy + 55)], fill=c)
        d.line([(cx + 40, cy), (cx + 40, cy + 80)], fill="#FFFFFF", width=1)
        d.line([(cx, cy + 40), (cx + 80, cy + 40)], fill="#FFFFFF", width=1)
d.rectangle([(100, 680), (w - 100, 725)], fill="#0F0D0B", outline="#444444")
d.text((120, 692), "ELECTROMECHANICAL PARALLEL TESTING: 17,576 ROTOR COMBINATIONS/SEC", fill="#2ECC71")
save_to_all("img_bombe.jpg", im)

# 5. img_bletchley.jpg - Bletchley Park Station X Mansion
w, h = 960, 640
im = Image.new("RGB", (w, h), "#2B2620")
d = ImageDraw.Draw(im)
d.rectangle([(30, 30), (w - 30, h - 30)], outline="#8E7D6B", width=4)
# Header
d.rectangle([(45, 45), (w - 45, 110)], fill="#171411")
d.text((80, 65), "GOVERNMENT CODE AND CYPHER SCHOOL // BLETCHLEY PARK, BUCKINGHAMSHIRE", fill="#E6D3B3")
d.text((80, 85), "TOP SECRET // STATION X ARCHIVES // 1939 - 1945", fill="#C0392B")
# Victorian Manor representation
d.rectangle([(120, 260), (840, 520)], fill="#4A3F35", outline="#736354", width=3)
# Central gable
d.polygon([(400, 260), (480, 160), (560, 260)], fill="#5C4D41", outline="#8E7D6B", width=2)
# Windows
for row in range(2):
    for col in range(8):
        wx = 160 + col * 85
        wy = 300 + row * 90
        d.rectangle([(wx, wy), (wx + 45, wy + 60)], fill="#F5E6CA", outline="#241E1A", width=2)
        d.line([(wx + 22, wy), (wx + 22, wy + 60)], fill="#241E1A", width=1)
        d.line([(wx, wy + 30), (wx + 45, wy + 30)], fill="#241E1A", width=1)
d.rectangle([(445, 420), (515, 520)], fill="#1E1915") # Entrance
d.text((120, 560), "WHERE 10,000 INTELLECTS WORKED IN TOTAL SECRECY TO SHORTEN THE WAR", fill="#F39C12")
save_to_all("img_bletchley.jpg", im)

# 6. img_turing_obe.jpg - 1945 Officer of the Order of the British Empire
w, h = 850, 1050
im = Image.new("RGB", (w, h), "#EFE8DC")
d = ImageDraw.Draw(im)
d.rectangle([(35, 35), (w - 35, h - 35)], outline="#B09F85", width=3)
d.rectangle([(45, 45), (w - 45, h - 45)], outline="#D0C4AF", width=1)
# Royal Crest banner
d.rectangle([(55, 55), (w - 55, 140)], fill="#6B1D2F")
d.text((160, 75), "BUCKINGHAM PALACE // CENTRAL CHANCERY", fill="#FDE047")
d.text((120, 105), "THE MOST EXCELLENT ORDER OF THE BRITISH EMPIRE", fill="#FFFFFF")
obe_lines = [
    "GEORGE THE SIXTH, by the Grace of God of Great Britain,",
    "Ireland and the British Dominions beyond the Seas King...",
    "----------------------------------------------------------------------",
    "TO OUR TRUSTY AND WELL-BELOVED: ALAN MATHISON TURING, ESQ., Ph.D.",
    "",
    "WE DO BY THESE PRESENTS APPOINT YOU TO BE AN OFFICER",
    "OF THE CIVIL DIVISION OF OUR SAID ORDER (O.B.E.)",
    "",
    "CITATION RECORD: 'FOR VITAL WAR SERVICES RENDERED IN THE FOREIGN OFFICE'",
    "(SPECIFIC WAR SERVICES WITHHELD UNDER THE OFFICIAL SECRETS ACT)",
    "----------------------------------------------------------------------",
    "GIVEN AT OUR COURT AT SAINT JAMES'S // 1945",
    "BY HIS MAJESTY'S COMMAND: [SEAL AFFIXED]"
]
y = 190
for line in obe_lines:
    color = "#881337" if "ALAN MATHISON TURING" in line or "O.B.E." in line else "#1C1917"
    d.text((80, y), line, fill=color)
    y += 45
# Gold Medal representation
d.ellipse([(w//2 - 90, 750), (w//2 + 90, 930)], fill="#D4AF37", outline="#854D0E", width=6)
d.text((w//2 - 60, 825), "FOR GOD AND", fill="#1C1917")
d.text((w//2 - 50, 855), "THE EMPIRE", fill="#1C1917")
save_to_all("img_turing_obe.jpg", im)

# 7. img_turing_statue.jpg - Alan Turing Memorial Statue (Sackville Gardens, Manchester)
w, h = 880, 1000
im = Image.new("RGB", (w, h), "#181C1D")
d = ImageDraw.Draw(im)
d.rectangle([(30, 30), (w - 30, h - 30)], outline="#3A4D51", width=3)
d.rectangle([(45, 45), (w - 45, 115)], fill="#0F1415")
d.text((80, 68), "ALAN TURING MEMORIAL // SACKVILLE GARDENS, MANCHESTER", fill="#E2E8F0")
d.text((80, 90), "UNVEILED 23 JUNE 2001 // BRONZE SCULPTURE BY GLYN HUGHES", fill="#06B6D4")
# Memorial Bench & Statue silhouette
d.rectangle([(160, 460), (720, 520)], fill="#3B4247", outline="#606C74", width=3) # Bench seat
d.rectangle([(200, 520), (240, 750)], fill="#252A2D") # Bench leg
d.rectangle([(640, 520), (680, 750)], fill="#252A2D") # Bench leg
# Turing sitting figure in bronze
d.ellipse([(400, 230), (480, 310)], fill="#5C5449", outline="#8A7E6E", width=2) # Head
d.polygon([(380, 310), (500, 310), (530, 500), (360, 500)], fill="#4B443B") # Coat
d.polygon([(360, 500), (440, 500), (430, 720), (370, 720)], fill="#3E3831") # Legs
# Bronze Apple in his hand
d.ellipse([(510, 420), (540, 450)], fill="#D4AF37", outline="#FFFFFF", width=2)
d.text((550, 425), "APPLE WITH CYANIDE BITE", fill="#F59E0B")
# Memorial Inscription Plaque
d.rectangle([(120, 800), (760, 940)], fill="#121617", outline="#8A7E6E", width=2)
d.text((150, 825), "'FATHER OF COMPUTER SCIENCE, MATHEMATICIAN, LOGICIAN,", fill="#FDE047")
d.text((150, 860), " WARTIME CODEBREAKER, VICTIM OF PREJUDICE.'", fill="#FDE047")
d.text((150, 900), "BERTRAND RUSSELL: 'MATHEMATICS, RIGHTLY VIEWED, POSSESSES SUPREME BEAUTY'", fill="#94A3B8")
save_to_all("img_turing_statue.jpg", im)

print("All 7 Alan Turing documentary visual assets successfully built and saved!")

