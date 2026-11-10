import subprocess
import sys
import json
import os

scenes = [
    (
        "workspace/public/turing_s1.wav",
        "Negaranya membutuhkan otaknya untuk memenangkan perang. Tapi ketika perang selesai, justru negaranya sendiri yang menghancurkan hidupnya.",
        "Negaranya membutuhkan otaknya untuk memenangkan perang. Tapi ketika perang selesai, justru negaranya sendiri yang menghancurkan hidupnya."
    ),
    (
        "workspace/public/turing_s2.wav",
        "Namanya Alan Turing. Seorang matematikawan Inggris yang memiliki cara berpikir jauh melampaui zamannya. Saat Perang Dunia Kedua pecah, kemampuannya dibutuhkan untuk menghadapi senjata paling berbahaya Nazi: mesin Enigma.",
        "Namanya Elan Tyuring. Seorang matematikawan Inggris yang memiliki cara berpikir jauh melampaui zamannya. Saat Perang Dunia Kedua pecah, kemampuannya dibutuhkan untuk menghadapi senjata paling berbahaya Nat-si: mesin Enigma."
    ),
    (
        "workspace/public/turing_s3.wav",
        "Enigma bukan sekadar mesin biasa. Alat ini mengacak pesan militer Jerman dengan sistem yang sangat rumit. Bahkan ketika pesan disadap, isinya tetap mustahil dibaca tanpa kuncinya.",
        "Enigma bukan sekadar mesin biasa. Alat ini mengacak pesan militer Jerman dengan sistem yang sangat rumit. Bahkan ketika pesan disadap, isinya tetap mustahil dibaca tanpa kuncinya."
    ),
    (
        "workspace/public/turing_s4.wav",
        "Turing kemudian mengembangkan mesin bernama Bombe. Bersama para pemecah kode Bletchley Park, ia berhasil membongkar komunikasi rahasia Jerman dan menyelamatkan jutaan nyawa.",
        "Tyuring kemudian mengembangkan mesin bernama Bombe. Bersama para pemecah kode Blec-li Park, ia berhasil membongkar komunikasi rahasia Jerman dan menyelamatkan jutaan nyawa."
    ),
    (
        "workspace/public/turing_s5.wav",
        "Tapi setelah perang, kisahnya berubah tragis. Pada tahun 1952, Turing dihukum hanya karena siapa dirinya. Ia dipaksa menjalani kebiri kimia oleh hukum negaranya sendiri.",
        "Tapi setelah perang, kisahnya berubah tragis. Pada tahun sembilan belas lima puluh dua, Tyuring dihukum hanya karena siapa dirinya. Ia dipaksa menjalani kebiri kimia oleh hukum negaranya sendiri."
    ),
    (
        "workspace/public/turing_s6.wav",
        "Pada 7 Juni 1954, Alan Turing ditemukan meninggal dunia di usia 41 tahun, mengakhiri hidupnya dalam kesunyian.",
        "Pada tujuh Juni sembilan belas lima puluh empat, Elan Tyuring ditemukan meninggal dunia di usia empat puluh satu tahun, mengakhiri hidupnya dalam kesunyian."
    ),
    (
        "workspace/public/turing_s7.wav",
        "Kini, seluruh dunia komputer dan kecerdasan buatan berdiri di atas pemikirannya. Pengampunan kerajaan baru diberikan tahun 2013. Tapi pertanyaannya... berapa banyak orang jenius yang harus dihancurkan sebelum dunia belajar menghargai perbedaan?",
        "Kini, seluruh dunia komputer dan kecerdasan buatan berdiri di atas pemikirannya. Pengampunan kerajaan baru diberikan tahun dua ribu tiga belas. Tapi pertanyaannya... berapa banyak orang jenius yang harus dihancurkan sebelum dunia belajar menghargai perbedaan?"
    )
]

results = []

for out, text, spoken in scenes:
    cmd = [
        sys.executable, "core/voicebox/voicebox_engine.py",
        "--text", text,
        "--spoken-text", spoken,
        "--out", out,
        "--voice", "aetheria",
        "--style", "mystery",
        "--lang", "id"
    ]
    print(f"Synthesizing {out}...")
    subprocess.run(cmd, check=True)
    words_file = out + ".words.json"
    if os.path.exists(words_file):
        with open(words_file, "r", encoding="utf-8") as f:
            meta = json.load(f)
            dur = meta.get("duration", 0)
            results.append({"file": out, "duration": dur, "frames": round((dur + 0.6) * 30)})

print("\n--- SYNTHESIS COMPLETE ---")
print(json.dumps(results, indent=2))

