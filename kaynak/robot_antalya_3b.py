# Antalya 2026 robotumuzun ayrıntılı 3B modeli.
# Kaynak: 27 Kasım 2026'da çekilen 50 fotoğraf (üstten çekim 10 ve 49, yandan 24, önden 38, yakın çekimler 19-22).
# Ölçek: üstten çekimde 18650 pil boyu (65 mm) ≈ 27 piksel/cm. Koordinatlar cm; x ileri, y sol, z yerden yukarı.
# "kati": True parçalar çarpışmaya girer (şasi eteği, motor kutuları, iç huni, stoper); "gorsel": True olanlar sadece görünüştür.
import math
SARI, SIYAH, KOYU = "#f2c200", "#1b1c1f", "#2b2d31"

def kutu(ad, x0, x1, y0, y1, z0, z1, renk, kati=False, **k):
    d = {"ad": ad, "x": round((x0 + x1) / 2, 2), "y": round((y0 + y1) / 2, 2), "uzunluk": round(abs(x1 - x0), 2), "genislik": round(abs(y1 - y0), 2),
         "z0": round(z0, 2), "z1": round(z1, 2), "renk": renk}
    if not kati: d.update({"kati": False, "gorsel": True})
    d.update(k); return d

def silindir(ad, x, y, z, cap, boy, eksen, renk, **k):
    d = {"ad": ad, "sekil": "silindir", "eksen": eksen, "x": round(x, 2), "y": round(y, 2), "z0": round(z - cap / 2, 2), "z1": round(z + cap / 2, 2),
         "uzunluk": round(boy if eksen == "x" else cap, 2), "genislik": round(boy if eksen == "y" else cap, 2), "renk": renk, "kati": False, "gorsel": True}
    if eksen == "z": d.update({"z0": round(z, 2), "z1": round(z + boy, 2), "uzunluk": cap, "genislik": cap})
    d.update(k); return d

def egik(ad, xa, ya, xb, yb, kal, z0, z1, renk, kati=True):
    L = math.hypot(xb - xa, yb - ya); a = math.degrees(math.atan2(yb - ya, xb - xa))
    d = {"ad": ad, "x": round((xa + xb) / 2, 2), "y": round((ya + yb) / 2, 2), "uzunluk": round(L, 2), "genislik": kal, "z0": z0, "z1": z1, "aci": round(a, 1), "renk": renk}
    if not kati: d.update({"kati": False, "gorsel": True})
    return d

def parcalar():
    P = []
    # ---- şasi (3B yazıcı, sarı PLA) ----
    P.append(kutu("Gövde (sarı şasi plakası)", -12.4, 12.4, -10.9, 10.9, 2.6, 3.2, SARI, kati=True))
    for s in (1, -1):
        P.append(kutu(("Sol" if s > 0 else "Sağ") + " ön köşe kanadı", 9.0, 12.4, s * 10.9, s * 14.3, 0.5, 3.2, SARI, kati=True))
        P.append(kutu(("Sol" if s > 0 else "Sağ") + " yan etek", -5.0, 1.3, s * 10.4, s * 10.9, 0.5, 2.6, SARI, kati=True))
    P.append(kutu("Arka etek", -12.4, -11.9, -9.6, 9.6, 0.5, 2.6, SARI, kati=True))
    P.append(kutu("Ön travers", 11.7, 12.4, -14.3, 14.3, 3.2, 3.9, SARI, kati=True))
    for i in range(11):                      # travers üstündeki dişler
        y = -12.5 + i * 2.5; P.append(kutu("Ön diş", 12.4, 12.9, y - 0.5, y + 0.5, 3.2, 3.9, SARI))
    for i in range(10):                      # tek yönlü kapakçıklar: yumurta iterek içeri girer, geri çıkamaz
        y = -10.35 + i * 2.3; P.append(kutu("Tek yönlü kapakçık", 11.95, 12.25, y - 0.5, y + 0.5, 0.35, 2.6, SIYAH, malzeme="kaucuk"))
    # ---- iç kanal: kapakçıklardan giren yumurtayı ortadaki ayıklayıcıya götürür ----
    for s in (1, -1):
        P.append(egik(("Sol" if s > 0 else "Sağ") + " iç huni", 7.9, s * 4.6, 11.6, s * 10.3, 0.4, 0.3, 2.5, KOYU))
        P.append(kutu(("Sol" if s > 0 else "Sağ") + " kanal duvarı", -3.4, 1.9, s * 4.6, s * 5.0, 0.3, 2.5, KOYU, kati=True))
    P.append(kutu("Ayıklayıcı stoperi", -3.8, -3.4, -5.0, 5.0, 0.3, 2.5, KOYU, kati=True))
    # ---- 4 motor kutusu (motor + redüktör içinde) ve pirinç kaplinler ----
    for xa, xb, ad in ((1.9, 7.8, "ön"), (-11.4, -8.4, "arka")):
        for s in (1, -1):
            renk = "#2a2a2c" if (ad == "ön" and s > 0) else SIYAH
            ust = 6.3 if ad == "ön" else 5.9
            P.append(kutu(("Sol " if s > 0 else "Sağ ") + ad + " motor kutusu (alt)", xa, xb, s * 4.6, s * 10.4, 0.8, 2.6, renk, kati=True))
            P.append(kutu(("Sol " if s > 0 else "Sağ ") + ad + " motor kutusu", xa, xb, s * 4.6, s * 10.4, 3.2, ust, renk, kati=True))
            for k in range(3):               # kutu kapağındaki vidalar
                P.append(silindir("Vida", xa + 0.8 + k * (xb - xa - 1.6) / 2, s * 5.3, 6.3 if ad == "ön" else 5.9, 0.45, 0.12, "z", "#9ca3af", malzeme="metal"))
    for xa in (5.1, -8.8):
        for s in (1, -1):
            P.append(silindir("Pirinç kaplin", xa, s * 10.9, 3.75, 0.9, 1.0, "y", "#c9a23f", malzeme="metal"))
    # ---- karbon desenli kapak (sol ön) ve QR etiket ----
    P.append(kutu("Karbon kapak", 2.2, 7.5, 4.9, 10.1, 6.3, 6.45, "#3a3b3f", malzeme="parlak"))
    P.append(kutu("QR etiket", 3.6, 5.6, 6.4, 8.6, 6.45, 6.5, "#f5f5f5"))
    # ---- acil stop (LAY5-ES542, mantar başlı) sağ ön motor kutusunun üstünde ----
    P.append(kutu("Acil stop gövdesi", 1.0, 3.4, -10.3, -7.7, 6.3, 12.0, SIYAH))
    P.append(kutu("Acil stop kontak blokları", 1.2, 3.2, -10.1, -7.9, 7.2, 9.2, "#26272b"))
    P.append(silindir("Acil stop boğazı", 2.2, -9.0, 11.6, 2.8, 0.5, "z", "#3a3b3f"))
    P.append(silindir("Acil stop mantarı", 2.2, -9.0, 12.1, 4.0, 1.7, "z", "#d81f26", malzeme="parlak"))
    P.append(silindir("DUR/STOP etiketi", 2.2, -9.0, 13.8, 2.6, 0.08, "z", "#f4c430"))
    # ---- 18650 piller (Orion 2450 mAh): beyaz gövde, kırmızı bant, siyah yuvalar ----
    def pil(x, y, z=4.15):
        return [silindir("18650 pil", x, y - 0.45, z, 1.85, 5.4, "y", "#f1f1ee"), silindir("Pil bandı", x, y + 2.6, z, 1.87, 1.2, "y", "#d72027"),
                silindir("Pil ucu", x, y + 3.25, z, 1.1, 0.15, "y", "#b9bcc2", malzeme="metal")]
    for x0, yc, xs in ((8.85, -3.5, (8.85,)), (8.85, 3.4, (8.85,)), (-1.55, -8.7, (-2.5, -0.6)), (-6.05, -7.25, (-6.9, -5.2)), (-6.35, 6.85, (-7.1, -5.6))):
        P.append(kutu("Pil yuvası", min(xs) - 1.1, max(xs) + 1.1, yc - 3.5, yc + 3.5, 3.2, 4.0, SIYAH))
        for x in xs: P += pil(x, yc)
    # ---- arka: iki BTS7960 sürücü (mavi kart, alüminyum soğutucu, yeşil klemens) ----
    for xc, yc in ((-12.65, -6.55), (-11.85, 6.3)):
        P.append(kutu("BTS7960 soğutucu tabanı", xc - 2.3, xc + 2.3, yc - 2.3, yc + 2.3, 6.0, 6.3, "#b8bcc4", malzeme="metal"))
        for k in range(6): P.append(kutu("Soğutucu kanadı", xc - 2.2 + k * 0.85, xc - 2.0 + k * 0.85, yc - 2.3, yc + 2.3, 5.9, 7.0, "#c3c7ce", malzeme="metal"))
        P.append(kutu("BTS7960 kartı", xc - 2.5, xc + 2.5, yc - 2.5, yc + 2.5, 7.0, 7.16, "#1f5fbf", malzeme="pcb"))
        P.append(kutu("Klemens", xc + 1.0, xc + 2.2, yc - 1.4, yc + 1.4, 7.16, 8.0, "#22a84a"))
        P.append(kutu("Kontrol entegresi", xc - 1.6, xc - 0.4, yc - 1.0, yc + 0.6, 7.16, 7.4, SIYAH))
        P.append(kutu("Pin başlığı", xc - 2.3, xc - 1.8, yc - 1.8, yc + 1.8, 7.16, 8.0, SIYAH))
    # ---- kontrol katı: Arduino Mega (altta), delikli pertinaks + Arduino Nano (üstte) ----
    P.append(kutu("Arduino Mega", -13.3, -3.1, -3.15, 2.15, 5.6, 5.75, "#0e7490", malzeme="pcb"))
    P.append(kutu("Mega USB-B", -13.9, -12.4, -1.4, -0.2, 5.75, 6.85, "#b9bcc2", malzeme="metal"))
    P.append(kutu("Mega dişi başlıklar", -12.0, -3.6, 1.6, 2.0, 5.75, 6.6, SIYAH))
    for k in range(4): P.append(silindir("Ara direk", -12.2 + (k % 2) * 7.6, -2.6 + (k // 2) * 4.4, 5.75, 0.5, 1.65, "z", "#d4b24a", malzeme="metal"))
    P.append(kutu("Delikli pertinaks", -12.4, -4.4, -4.0, 2.9, 7.4, 7.55, "#9a6233"))
    P.append(kutu("Nano dişi başlık", -11.4, -6.8, -1.25, -0.95, 7.55, 7.95, SIYAH))
    P.append(kutu("Nano dişi başlık", -11.4, -6.8, 0.35, 0.65, 7.55, 7.95, SIYAH))
    P.append(kutu("Arduino Nano", -11.45, -6.75, -1.2, 0.6, 7.95, 8.05, "#1d4ed8", malzeme="pcb"))
    P.append(kutu("Nano USB", -11.9, -11.1, -0.6, 0.0, 8.05, 8.45, "#b9bcc2", malzeme="metal"))
    P.append(kutu("Nano işlemcisi", -9.6, -8.6, -0.8, 0.2, 8.05, 8.2, SIYAH))
    P.append(silindir("Anahtar", -6.0, 1.9, 7.55, 0.5, 1.1, "z", "#b9bcc2", malzeme="metal"))
    for k, c in enumerate(("#e63946", "#f4a261", "#2a9d8f", "#264653", "#e9c46a", "#8338ec")):
        P.append(kutu("Pertinaks kablo", -10.5 + k * 0.7, -10.2 + k * 0.7, -3.8, 2.7, 7.55, 7.7, c))
    # ---- ortadaki ayıklayıcı: gri motor + siyah üç kanatlı tokat (şasideki pencereden görünür) ----
    P.append(kutu("Ayıklayıcı penceresi", -3.1, 3.3, -4.6, 4.4, 3.2, 3.22, "#0b0b0c"))
    P.append(silindir("Ayıklayıcı motoru", 4.6, -0.4, 4.6, 2.6, 3.6, "x", "#a7abb2", malzeme="metal"))
    P.append(kutu("Ayıklayıcı redüktörü", 1.2, 2.8, -1.7, 0.9, 3.3, 5.9, SIYAH))
    P.append(silindir("Tokat göbeği", 0.3, -0.4, 3.22, 1.4, 0.6, "z", SIYAH))
    for a in (0, 120, 240):
        r = math.radians(a); P.append(egik("Tokat kanadı", 0.3, -0.4, 0.3 + 2.4 * math.cos(r), -0.4 + 2.4 * math.sin(r), 0.9, 3.25, 3.7, SIYAH, kati=False))
    # ---- yan çıkış kapısı (sol, rakip yumurtası dışarı) ve arka bölme kapıları ----
    P.append(kutu("Yan kapı servosu", -3.2, -0.9, 11.0, 12.2, 3.2, 6.0, "#1f3b8f"))
    P.append(kutu("Yan çıkış kapağı", -4.8, 0.7, 12.2, 12.5, 0.4, 3.2, SIYAH))
    P.append(kutu("Arka bölme kapağı", -12.9, -12.4, -3.6, 3.6, 0.4, 2.6, SIYAH))
    for y in (-1.8, 1.8): P.append(kutu("Kapak servosu", -12.2, -10.0, y - 0.6, y + 0.6, 3.2, 5.9, "#1f3b8f"))
    # ---- küçük motor sürücüsü (ayıklayıcı için, kırmızı) ----
    P.append(kutu("Küçük sürücü kartı", -2.8, 0.4, 5.5, 9.7, 3.6, 3.75, "#c1272d", malzeme="pcb"))
    P.append(kutu("Küçük sürücü soğutucusu", -1.9, -0.5, 6.6, 8.6, 3.75, 4.6, SIYAH))
    for y in (6.0, 9.2): P.append(kutu("Mavi klemens", 0.0, 0.4, y - 0.5, y + 0.5, 3.75, 4.5, "#1d6fd8"))
    # ---- ön köşelerde 2'şer MZ80 (E18-D80NK) göz: üstteki kodda kullanılıyor, alttaki boşta ----
    for s in (1, -1):
        P.append(silindir("MZ80 (üst, bağlı, çapraz)", 9.75, s * 10.1, 3.6, 1.8, 4.5, "x", "#e0a21b", aci=s * 25))
        P.append(silindir("MZ80 (alt)", 9.75, s * 12.5, 1.6, 1.8, 4.5, "x", "#e0a21b"))
        for xx, yy, zz, a in ((11.8, 11.05, 3.6, 25), (11.9, 12.5, 1.6, 0)):
            P.append(silindir("MZ80 merceği", xx, s * yy, zz, 1.2, 0.25, "x", "#3a0d3f", malzeme="parlak", aci=s * a))
            P.append(silindir("MZ80 somunu", xx - 1.25, s * (yy - (0.55 if a else 0)), zz, 2.2, 0.35, "x", "#c8901a", aci=s * a))
        P.append(kutu("Kablo bağı", 9.0, 9.4, s * 10.2, s * 13.4, 0.6, 4.6, "#22c55e"))
    for x in (-6.5, -1.0): P.append(kutu("Kablo bağı", x - 0.15, x + 0.15, -1.2, 1.2, 9.6, 10.4, "#f8fafc"))
    return P


def kablolar():
    """Fotoğraflardaki gibi pertinakstan her parçaya yukarı kavis yaparak giden renkli jumper kablolar."""
    import random
    R = random.Random(2026)
    renk = ["#e11d48", "#f97316", "#facc15", "#16a34a", "#2563eb", "#7c3aed", "#92400e", "#9ca3af", "#f8fafc", "#111827", "#ec4899", "#06b6d4"]
    hedefler = [  # (x, y, z, kablo sayısı)
        (-12.1, -6.0, 8.0, 4), (-11.3, 6.8, 8.0, 4),           # BTS7960 kontrol pinleri
        (2.2, -8.4, 9.0, 3),                                     # acil stop kontakları
        (7.3, 11.0, 3.8, 3), (7.3, -11.0, 3.8, 3), (7.5, 12.5, 1.9, 2), (7.5, -12.5, 1.9, 2),  # MZ80 gözler
        (10.6, 6.5, 3.4, 3),                                     # NeoPixel şerit
        (4.6, -0.4, 6.0, 2), (-1.2, 7.6, 4.6, 4),                # ayıklayıcı motoru ve küçük sürücü
        (-2.0, 11.6, 6.0, 3), (-11.1, 1.8, 6.0, 3), (-11.1, -1.8, 6.0, 3),   # kapı servoları
        (-2.6, 2.0, 3.2, 4), (9.0, 0.5, 3.2, 4),                 # alt katta renk sensörleri (pencereden ve önden iner)
        (4.8, 7.5, 6.4, 2), (4.8, -5.6, 6.4, 2), (-9.9, 7.5, 6.0, 2), (-9.9, -7.5, 6.0, 2),   # motor kabloları
        (-6.0, 1.9, 6.6, 3),                                     # Mega başlıkları
    ]
    K = []
    for hx, hy, hz, n in hedefler:
        for _ in range(n):
            sx, sy, sz = R.uniform(-11.0, -5.2), R.uniform(-3.5, 2.5), 7.7
            ex, ey, ez = hx + R.uniform(-0.4, 0.4), hy + R.uniform(-0.4, 0.4), hz
            tepe = max(sz, ez) + R.uniform(1.2, 3.6)
            m1 = (sx + (ex - sx) * 0.3 + R.uniform(-1, 1), sy + (ey - sy) * 0.3 + R.uniform(-1, 1), tepe)
            m2 = (sx + (ex - sx) * 0.7 + R.uniform(-1, 1), sy + (ey - sy) * 0.7 + R.uniform(-1, 1), tepe - R.uniform(0, 1.2))
            K.append({"renk": R.choice(renk), "kalinlik": 0.17, "noktalar": [[round(v, 2) for v in q] for q in
                      ((sx, sy, sz), (sx, sy, sz + 0.9), m1, m2, (ex, ey, ez + 0.9), (ex, ey, ez))]})
    return K
