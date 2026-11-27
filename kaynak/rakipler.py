# Yarışma videolarından (Antalya 2026, 22 maç) çıkarılmış rakip robot tipleri.
# Görünüş, gövde ölçüsü ve mekanizma videodan YAKLAŞIK alındı; motor, pil ve kodlar temsilidir (videoda görünmez).
# Hepsi Arduino Uno + aynı pin düzeni (L298N: 5/7/8 – 6/9/10, HC-SR04 11/12, zemin A0, renk A1/A2/13, LED A3/A4, köşe anahtarı A5).
import math, os
F, T, N = False, True, None
HERE = os.path.dirname(os.path.abspath(__file__))
def kod(ad): return open(os.path.join(HERE, 'ornek_kodlar', ad) if not ad.endswith('strateji.ino') else os.path.join(HERE, ad)).read()

def k(ad, x0, x1, y0, y1, z0, z1, renk, kati=True, **e):
    d = {"ad": ad, "x": round((x0 + x1) / 2, 2), "y": round((y0 + y1) / 2, 2), "uzunluk": round(abs(x1 - x0), 2), "genislik": round(abs(y1 - y0), 2), "z0": z0, "z1": z1, "renk": renk}
    if not kati: d.update({"kati": F, "gorsel": T})
    d.update(e); return d

def egik(ad, xa, ya, xb, yb, kal, z0, z1, renk, kati=True):
    d = {"ad": ad, "x": round((xa + xb) / 2, 2), "y": round((ya + yb) / 2, 2), "uzunluk": round(math.hypot(xb - xa, yb - ya), 2), "genislik": kal, "z0": z0, "z1": z1,
         "aci": round(math.degrees(math.atan2(yb - ya, xb - xa)), 1), "renk": renk}
    if not kati: d.update({"kati": F, "gorsel": T})
    return d

def sil(ad, x, y, z, cap, boy, eksen, renk, **e):
    d = {"ad": ad, "sekil": "silindir", "eksen": eksen, "x": x, "y": y, "z0": round(z - cap / 2, 2), "z1": round(z + cap / 2, 2),
         "uzunluk": boy if eksen == "x" else cap, "genislik": boy if eksen == "y" else cap, "renk": renk, "kati": F, "gorsel": T}
    if eksen == "z": d.update({"z0": z, "z1": z + boy, "uzunluk": cap, "genislik": cap})
    d.update(e); return d

def ortak_ust(x, y, z, renk_kart="#0e7490"):
    """Uno + L298N + pil + acil stop: her robotta olan üst kat ayrıntıları"""
    return [k("Arduino Uno", x - 3.4, x + 3.4, y - 2.7, y + 2.7, z, z + 0.15, renk_kart, F, malzeme="pcb"),
            k("Uno başlıkları", x - 3.0, x + 3.0, y + 2.2, y + 2.6, z + 0.15, z + 1.0, "#111827", F),
            k("L298N", x - 2.1, x + 2.1, y - 7.5, y - 3.3, z, z + 0.15, "#c1272d", F, malzeme="pcb"),
            k("L298N soğutucu", x - 1.2, x + 1.2, y - 6.6, y - 4.2, z + 0.15, z + 2.4, "#111827", F),
            sil("Acil stop", x - 5.5, y + 4.5, z, 3.4, 2.0, "z", "#d81f26", malzeme="parlak"),
            sil("Acil stop etiketi", x - 5.5, y + 4.5, z + 2.0, 2.2, 0.08, "z", "#f4c430")]

def kablolar(x, y, z, hedefler, tohum):
    import random
    R = random.Random(tohum); renk = ["#e11d48", "#f97316", "#facc15", "#16a34a", "#2563eb", "#7c3aed", "#f8fafc", "#111827"]; K = []
    for hx, hy, hz in hedefler:
        for _ in range(2):
            sx, sy = x + R.uniform(-2.5, 2.5), y + R.uniform(-2, 2); t = max(z, hz) + R.uniform(1.0, 2.8)
            K.append({"renk": R.choice(renk), "kalinlik": 0.16, "noktalar": [[round(v, 2) for v in q] for q in
                     ((sx, sy, z + 0.2), (sx + (hx - sx) * .3, sy + (hy - sy) * .3, t), (sx + (hx - sx) * .7, sy + (hy - sy) * .7, t - .6), (hx, hy, hz))]})
    return K

def devre(sensorler, servolar, led_x, led_z, led_y=0):
    return {"surucu": {"tip": "L298N", "sol": {"en": 5, "in1": 7, "in2": 8}, "sag": {"en": 6, "in1": 9, "in2": 10}, "sol_ters": F, "sag_ters": F},
            "sensorler": sensorler + [{"tip": "BUTON", "ad": "Köşe anahtarı", "pin": "A5", "deger": "KIRMIZIDA_HIGH"}],
            "servolar": servolar, "led": {"tip": "iki_pin", "kirmizi_pin": "A3", "mavi_pin": "A4", "x": led_x, "y": led_y, "z": led_z, "uzunluk": 6, "genislik": 1.2},
            "yerlesim": []}

US = lambda x, z: {"tip": "HC-SR04", "ad": "Ön ultrasonik", "trig": 11, "echo": 12, "x": x, "y": 0, "z": z, "aci": 0}
ZEM = lambda x: {"tip": "TCRT5000", "ad": "Zemin", "pin": "A0", "x": x, "y": 0, "z": 1, "esik": 500}
def ultrason_gorsel(x, z):
    return [k("HC-SR04 kartı", x - 0.3, x, -2.25, 2.25, z - 1.0, z + 1.0, "#1d4ed8", F, malzeme="pcb"),
            sil("Ultrasonik göz", x + 0.5, 1.3, z, 1.6, 1.2, "x", "#c8ccd2", malzeme="metal"), sil("Ultrasonik göz", x + 0.5, -1.3, z, 1.6, 1.2, "x", "#c8ccd2", malzeme="metal")]

def kepce_ve_kapak(x_on, renk):
    """Kapaklı kepçe: iki yan kol + arka duvar, servo ile kapanan kapak (Yum Yum stratejisi pin 3)"""
    return [k("Kepçe arka", x_on, x_on + 1, -6.5, 6.5, 0.3, 4.3, renk), k("Sol kol", x_on + 1, x_on + 8.5, 5.5, 6.5, 0.3, 4.3, renk), k("Sağ kol", x_on + 1, x_on + 8.5, -6.5, -5.5, 0.3, 4.3, renk),
            k("SG90 servo", x_on + 6.3, x_on + 8.6, 5.7, 6.9, 4.3, 6.6, "#2563eb", F),
            {"ad": "Kapak", "servo_pin": 3, "pivot": [x_on + 9.0, 6.0], "uzunluk": 11, "genislik": 0.8, "aci_ofset": -90, "yon": 1, "z0": 0.3, "z1": 4, "renk": "#f59e0b"}]

def kepce_sensorleri(x_on, ir_x):
    return [{"tip": "IR_ENGEL", "ad": "Sol IR", "pin": 2, "x": ir_x, "y": 7.5, "z": 1.5, "aci": 40, "menzil_cm": 14},
            {"tip": "IR_ENGEL", "ad": "Sağ IR", "pin": 4, "x": ir_x, "y": -7.5, "z": 1.5, "aci": -40, "menzil_cm": 14},
            {"tip": "TCS3200", "ad": "Renk (kepçe)", "s2": "A1", "s3": "A2", "out": 13, "olcek": 20, "x": x_on + 1.6, "y": 0, "z": 1, "aci": 0, "bakis": "ileri", "menzil_cm": 2.5}]

def hazne_sensorleri(bogaz_x):
    return [{"tip": "IR_ENGEL", "ad": "Boğaz sensörü", "pin": 2, "x": bogaz_x + 2.0, "y": -3.0, "z": 1, "aci": 90, "menzil_cm": 5},
            {"tip": "TCS3200", "ad": "Boğaz renk", "s2": "A1", "s3": "A2", "out": 13, "olcek": 20, "x": bogaz_x, "y": 0, "z": 1, "aci": 0, "bakis": "ileri", "menzil_cm": 2.5}]

def hazne_ayari(bogaz_x, arka_x, kap=6):
    return {"var": T, "agiz": {"x0": bogaz_x, "x1": bogaz_x + 4.5, "y0": -3.2, "y1": 3.2},
            "kurallar": [{"servo": 3, "min": 150, "max": 180, "hedef": "bizim"}, {"servo": 3, "min": 0, "max": 30, "hedef": "disari"}],
            "bolmeler": [{"ad": "bizim", "kapasite": kap, "kapak": 4, "acik_min": 100, "acik_max": 180, "cikis": {"x": arka_x - 2.5, "y": 0}}],
            "disari": {"x": bogaz_x + 2, "y": -13, "hiz_cms": 45}}

def hazne_kanali(bogaz_x, renk):
    return [k("Sol boğaz duvarı", bogaz_x - 0.5, bogaz_x + 5, 3.4, 3.9, 0.3, 2.6, renk), k("Sağ boğaz duvarı", bogaz_x - 0.5, bogaz_x + 5, -3.9, -3.4, 0.3, 2.6, renk),
            k("Boğaz stoperi", bogaz_x - 0.9, bogaz_x - 0.5, -3.9, 3.9, 0.3, 2.6, renk)]

SERVO_HAZNE = [{"ad": "Tokat (ayıklayıcı)", "pin": 3, "hiz_derece_s": 500, "baslangic_aci": 90}, {"ad": "Boşaltma kapağı", "pin": 4, "hiz_derece_s": 300, "baslangic_aci": 0}]
SERVO_KAPAK = [{"ad": "Kapak servosu", "pin": 3, "hiz_derece_s": 450, "baslangic_aci": 0}]

def profil(id, ad, renk, aciklama, kod_metni, mekanik, dev):
    return {"id": id, "ad": ad, "renk": renk, "aciklama": aciklama, "kartlar": [{"id": "ana", "tip": "Uno", "kod": kod_metni}], "kart_baglantilari": [],
            "mekanik": dict({"detayli_gorunum": T, "model3d": N}, **mekanik), "devre": dev}

def hepsi():
    P = []
    # 1) KIRMIZI 4 TEKERLİ, LED BANTLI, KAPAKLI KEPÇE — videolarda en sık görülen tip (v01, v05, v06, v07, v13, v18)
    R = "#c81e2a"
    parts = [k("Kırmızı alt şasi", -10, 9, -8.2, 8.2, 2.4, 3.0, R), k("Sol yan plaka", -10, 9, 8.2, 8.7, 0.8, 6.5, R), k("Sağ yan plaka", -10, 9, -8.7, -8.2, 0.8, 6.5, R),
             k("Kırmızı üst kat", -9, 7, -7.5, 7.5, 6.5, 7.0, R, F), k("Ön LED bandı", 8.9, 9.2, -6.5, 6.5, 3.2, 4.0, "#ef4444", F, malzeme="led")]
    for i in range(8): parts.append(k("LED", 9.2, 9.35, -5.6 + i * 1.6, -5.0 + i * 1.6, 3.35, 3.85, "#ffd2d2", F, malzeme="led"))
    for x in (-8.5, 5.5):
        for y in (-6, 6): parts.append(sil("Direk", x, y, 3.0, 0.5, 3.5, "z", "#c9a23f", malzeme="metal"))
    parts += kepce_ve_kapak(9, "#7f1d1d") + ultrason_gorsel(9.2, 5.5) + ortak_ust(-1, 0, 7.0)
    parts += [sil("Pil", -6.5, -3.2, 4.0, 1.85, 6.5, "y", "#2563eb"), sil("Pil", -4.4, -3.2, 4.0, 1.85, 6.5, "y", "#2563eb")]
    P.append(profil("kirmizi4", "Kırmızı LED bantlı 4 teker (video)", R,
        "Antalya maç videolarında en çok görülen tip (6 maçta): kırmızı pleksi/MDF gövde, 4 büyük beyaz teker, önde LED bant, kapaklı kepçe. Görünüş videodan yaklaşık; motor, pil ve kod temsili.",
        kod("strateji.ino"),
        {"kutle_kg": 1.7, "agirlik_merkezi": {"x_cm": -1, "z_cm": 4.5}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 8, "genislik_cm": 3.2, "iz_cm": 20.5, "x_cm": -1.5, "adet": 4, "dingil_cm": 12, "jant_renk": "#f3f4f6", "lastik_renk": "#e5e7eb"},
         "sarhos_teker": N, "motor": {"model": "JGA25-370 12V 280"}, "pil": {"volt": 11.1, "mah": 2500}, "acil_stop": {"x": -6.5, "y": 4.5, "z": 7}, "parcalar": parts,
         "kablolar": kablolar(-1, 0, 7.2, [(9.2, 0, 5.5), (12, 5.5, 4.5), (9.5, 7.5, 1.5), (9.5, -7.5, 1.5), (-5, -3, 5)], 1)},
        devre([US(9.2, 5.5), ZEM(2)] + kepce_sensorleri(9, 9.4), SERVO_KAPAK, 9.1, 3.6)))

    # 2) YEŞİL BULDOZER — geniş yeşil plaka, üstte tel kulp, önde içbükey bıçak; renk ayırmadan iter (v02)
    G = "#15803d"
    # tekerler geniş plakanın altında gizli: plaka teker üstünde, yanlarda tekerin dışında etek
    parts = [k("Yeşil gövde plakası", -12, 10, -11.5, 11.5, 6.6, 7.4, G), k("Yeşil gövde yanı", -12, 10, 11, 11.5, 0.6, 6.6, G), k("Yeşil gövde yanı", -12, 10, -11.5, -11, 0.6, 6.6, G),
             k("Motor kutusu", -9, 1, -7.8, 7.8, 2.2, 6.6, "#166534"),
             k("Ön bıçak", 10, 10.6, -9, 9, 0.2, 3.5, "#14532d"), egik("Sol bıçak kanadı", 10.6, 9.3, 13.5, 12.5, 0.6, 0.2, 3.5, "#14532d"), egik("Sağ bıçak kanadı", 10.6, -9.3, 13.5, -12.5, 0.6, 0.2, 3.5, "#14532d"),
             k("Arka kapak", -12, -11.5, -10.5, 10.5, 0.6, 5.5, G)]
    for s in (1, -1): parts += [sil("Kulp ayağı", -2, s * 9, 7.4, 0.35, 5.5, "z", "#9ca3af", malzeme="metal")]
    parts.append(sil("Tel kulp", -2, 0, 12.9, 0.35, 18.4, "y", "#9ca3af", malzeme="metal"))
    parts += ultrason_gorsel(10.6, 5.0) + ortak_ust(-3, 0, 7.4)
    parts += [sil("Pil", -9, -2, 8.3, 1.85, 6.5, "y", "#16a34a"), sil("Pil", -9, 4.6, 8.3, 1.85, 6.5, "y", "#16a34a")]
    P.append(profil("yesil_buldozer", "Yeşil buldozer (video)", G,
        "Videodaki geniş, alçak yeşil plaka gövdeli robot: üstte tel kulp, önde içbükey bıçak. Renk sensörü yok; yumurtaları sürükleyerek sahayı tarar, kendi köşesine girince bırakır. Temsili.",
        kod("buldozer.ino"),
        {"kutle_kg": 1.5, "agirlik_merkezi": {"x_cm": -2, "z_cm": 3.5}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 6.5, "genislik_cm": 2.6, "iz_cm": 19, "x_cm": -4},
         "sarhos_teker": {"x_cm": 7, "y_cm": 0, "cap_cm": 1.6}, "motor": {"model": "TT 1:48 6V"}, "pil": {"volt": 7.4}, "acil_stop": {"x": -8.5, "y": 4.5, "z": 7.4}, "parcalar": parts,
         "kablolar": kablolar(-3, 0, 7.6, [(10.6, 0, 5), (2, 0, 1), (-9, 1, 7)], 2)},
        devre([US(10.6, 5.0), ZEM(2)], [], -6, 7.5)))

    # 3) MAVİ V KANATLI HUNİ — önde iki büyük mavi kanat yumurtayı boğaza toplar, iç hazne + ayıklayıcı (v08)
    B = "#1d4ed8"
    parts = [k("Mavi şasi", -11, 6, -7.5, 7.5, 2.8, 3.4, B), k("Mavi yan", -11, 6, 7.5, 8, 0.8, 5.5, B), k("Mavi yan", -11, 6, -8, -7.5, 0.8, 5.5, B), k("Arka kapı", -11.5, -11, -4, 4, 0.4, 2.6, "#0f172a"),
             egik("Sol huni kanadı", 6.5, 3.9, 14.0, 12.0, 0.5, 0.3, 7.0, B), egik("Sağ huni kanadı", 6.5, -3.9, 14.0, -12.0, 0.5, 0.3, 7.0, B),
             k("Hazne kutusu", -10.5, 1.5, -5, 5, 3.4, 7.5, "#1e3a8a", F)]
    parts += hazne_kanali(1.5, "#0f172a") + ultrason_gorsel(6.3, 6.0) + ortak_ust(-5, 0, 7.5)
    parts += [k("Ultrason direği", 5.6, 6.0, -0.5, 0.5, 3.4, 5.0, "#0f172a", F), k("Tokat servosu", 0.2, 1.4, 4.2, 6.5, 3.4, 6.2, "#2563eb", F), k("Kapı servosu", -10.8, -8.5, 4.2, 5.4, 3.4, 6.2, "#2563eb", F)]
    P.append(profil("mavi_huni", "Mavi V kanatlı huni (video)", B,
        "Videodaki önü geniş mavi V kanatlı robot: kanatlar yumurtayı ortadaki boğaza toplar, renk sensörü bakar, tokat servosu kendi renginiyse hazneye iter, değilse yana atar. Hazne dolunca köşede arka kapağı açar. 4 büyük beyaz teker. Temsili.",
        kod("hazne.ino"),
        {"kutle_kg": 1.6, "agirlik_merkezi": {"x_cm": -3, "z_cm": 4.5}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 8.5, "genislik_cm": 3, "iz_cm": 19.5, "x_cm": -4, "adet": 4, "dingil_cm": 11, "jant_renk": "#f3f4f6", "lastik_renk": "#e5e7eb"},
         "sarhos_teker": N, "motor": {"model": "JGA25-370 12V 280"}, "pil": {"volt": 11.1, "mah": 2500}, "acil_stop": {"x": -10.5, "y": 4.5, "z": 7.5}, "parcalar": parts,
         "hazne": hazne_ayari(1.5, -11, 6), "kablolar": kablolar(-5, 0, 7.7, [(6.3, 0, 6.0), (1.5, 0, 1), (0.8, 5, 6), (-9.5, 5, 6)], 3)},
        devre([US(6.6, 6.0), ZEM(-2)] + hazne_sensorleri(1.5), SERVO_HAZNE, -8, 7.6)))

    # 4) SİYAH ALÇAK KUTU — kapalı siyah gövde, önde dar ağız, iç hazne (v09, v12)
    S = "#111827"
    parts = [k("Siyah kutu gövde", -11, 8, -9.5, 9.5, 6.2, 8.5, S), k("Sol etek", -11, 8, 9.0, 9.5, 0.6, 6.2, S), k("Sağ etek", -11, 8, -9.5, -9.0, 0.6, 6.2, S),
             k("İç sol duvar", -11, 8, 4.2, 5.9, 0.6, 6.2, S), k("İç sağ duvar", -11, 8, -5.9, -4.2, 0.6, 6.2, S),
             egik("Sol ağız yanağı", 8.4, 4.0, 12, 8.5, 0.6, 0.3, 4.5, S), egik("Sağ ağız yanağı", 8.4, -4.0, 12, -8.5, 0.6, 0.3, 4.5, S), k("Arka kapı", -11.5, -11, -3.5, 3.5, 0.4, 2.6, "#374151"),
             k("Üst kapak", -10.5, 7.5, -8.5, 8.5, 8.5, 8.8, "#1f2937", F, malzeme="parlak")]
    parts += hazne_kanali(-3.5, "#374151") + ultrason_gorsel(8.2, 6.0)
    parts += [sil("Acil stop", -7, 5, 8.8, 3.4, 2.0, "z", "#d81f26", malzeme="parlak"), sil("Acil stop etiketi", -7, 5, 10.8, 2.2, 0.08, "z", "#f4c430"),
              k("Mavi LED şeridi", 7.9, 8.2, -7, 7, 7.2, 7.8, "#3b82f6", F, malzeme="led")]
    P.append(profil("siyah_kutu", "Siyah alçak kutu (video)", S,
        "Videodaki kapalı, alçak siyah gövdeli robot: önde dar ağız, içinde ayıklayıcılı hazne, arka boşaltma kapağı. Gövde içine gizli iki küçük teker + sarhoş teker. Temsili.",
        kod("hazne.ino").replace("#define DOLU 4", "#define DOLU 5").replace("#define HIZ 185", "#define HIZ 200"),
        {"kutle_kg": 1.4, "agirlik_merkezi": {"x_cm": -4.5, "z_cm": 4}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 6, "genislik_cm": 2.2, "iz_cm": 15.5, "x_cm": -2},
         "sarhos_teker": {"x_cm": -9.5, "y_cm": 0, "cap_cm": 1.6}, "motor": {"model": "N20 6V 300"}, "pil": {"volt": 7.4}, "acil_stop": {"x": -7, "y": 5, "z": 8.8}, "parcalar": parts,
         "hazne": hazne_ayari(-3.5, -11, 7)},
        devre([US(8.4, 6.0), ZEM(-6)] + hazne_sensorleri(-3.5), SERVO_HAZNE, 7.9, 7.5)))

    # 5) AHŞAP KUTU — kontrplak/MDF kutu, üstünde beyaz kutu; önde geniş açıklık, ayıklamadan hepsini alır (v10)
    W = "#a16207"
    parts = [k("Ahşap taban", -13, 10, -9.6, 9.6, 2.6, 3.2, W), k("Ahşap yan", -13, 10, 9.6, 10.2, 0.5, 8, W), k("Ahşap yan", -13, 10, -10.2, -9.6, 0.5, 8, W),
             k("Ahşap arka", -13, -12.4, -9.6, 9.6, 3.2, 8, W), k("Arka kapı", -13.5, -13, -4, 4, 0.4, 2.6, "#713f12"),
             egik("Sol iç huni", 6.8, 3.9, 10, 9.3, 0.6, 0.3, 2.6, "#713f12"), egik("Sağ iç huni", 6.8, -3.9, 10, -9.3, 0.6, 0.3, 2.6, "#713f12"),
             k("Beyaz üst kutu", -9, 4, -7, 7, 8, 12.5, "#f5f5f4", F), k("Kırmızı LED sırası", 9.9, 10.2, -6, 6, 6, 6.8, "#ef4444", F, malzeme="led")]
    parts += hazne_kanali(1.5, "#713f12") + ultrason_gorsel(10.2, 5)
    parts += [sil("Acil stop", -11, 7, 8, 3.4, 2.0, "z", "#d81f26", malzeme="parlak"), sil("Acil stop etiketi", -11, 7, 10, 2.2, 0.08, "z", "#f4c430")]
    P.append(profil("ahsap_kutu", "Ahşap kutu (video)", W,
        "Videodaki ahşap kutu gövdeli, üstünde beyaz kutu olan ağır robot: önden giren her yumurtayı ayırmadan hazneye alır (yanlış renk = ceza riski), köşede boşaltır. Yavaş TT 1:120 motorlar. Temsili.",
        kod("hazne.ino").replace("#define SIRALA 1", "#define SIRALA 0").replace("#define HIZ 185", "#define HIZ 210").replace("#define DOLU 4", "#define DOLU 6"),
        {"kutle_kg": 2.4, "agirlik_merkezi": {"x_cm": -5, "z_cm": 5.5}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 6.5, "genislik_cm": 2.6, "iz_cm": 23.5, "x_cm": -2},
         "sarhos_teker": {"x_cm": -11, "y_cm": 0, "cap_cm": 2.0}, "motor": {"model": "TT 1:120 6V"}, "pil": {"volt": 7.4}, "acil_stop": {"x": -11, "y": 7, "z": 8}, "parcalar": parts,
         "hazne": hazne_ayari(1.5, -13, 8)},
        devre([US(10.4, 5), ZEM(-2)] + hazne_sensorleri(1.5), SERVO_HAZNE, 10, 7)))

    # 6) SARI 4WD TT KİTİ — klasik sarı tekerli 4 motorlu akıllı araba kiti + kapaklı kepçe (v15, v20)
    Y = "#f59e0b"
    parts = [k("Şeffaf pleksi alt kat", -12, 8, -6.1, 6.1, 3.6, 3.9, "#fde68a", malzeme="parlak"), k("Şeffaf pleksi üst kat", -11, 7, -6.5, 6.5, 7.4, 7.7, "#fde68a", F, malzeme="parlak"),
             k("Ön tampon", 8, 8.6, -6.1, 6.1, 1.0, 3.6, "#374151")]
    for x in (-8, 3):
        for s in (1, -1): parts.append(sil("TT motor", x, s * 4.8, 2.6, 2.0, 6.5, "x", Y))
    for x in (-10.5, 6):
        for y in (-5.5, 5.5): parts.append(sil("Direk", x, y, 3.9, 0.5, 3.5, "z", "#c9a23f", malzeme="metal"))
    parts += kepce_ve_kapak(8.6, "#374151") + ultrason_gorsel(8.0, 5.5) + ortak_ust(-2, 0, 7.7)
    parts += [sil("Pil", -9, -3.3, 4.85, 1.85, 6.5, "y", "#16a34a"), sil("Pil", -9, 3.3, 4.85, 1.85, 6.5, "y", "#16a34a")]
    P.append(profil("sari_tt_kit", "Sarı 4WD TT kiti (video)", Y,
        "Videoda görülen klasik 4 motorlu akıllı araba kiti: iki kat pleksi, 4 sarı TT motor ve sarı teker, önde kapaklı kepçe. 3×18650 (11,1 V) varsayıldı: simülasyonda 2×18650 ve L298N kaybıyla 4 TT motor yerinde hiç dönemiyor. Temsili.",
        kod("strateji.ino"),
        {"kutle_kg": 1.1, "agirlik_merkezi": {"x_cm": -2, "z_cm": 4.5}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 6.5, "genislik_cm": 2.7, "iz_cm": 15.5, "x_cm": -2.5, "adet": 4, "dingil_cm": 11, "jant_renk": "#fbbf24", "lastik_renk": "#111827"},
         "sarhos_teker": N, "motor": {"model": "TT 1:48 6V"}, "pil": {"volt": 11.1}, "acil_stop": {"x": -7.5, "y": 4.5, "z": 7.7}, "parcalar": parts,
         "kablolar": kablolar(-2, 0, 7.9, [(8, 0, 5.5), (12.5, 5.5, 4.5), (3, 4.8, 3)], 6)},
        devre([US(8.4, 5.5), ZEM(2)] + kepce_sensorleri(8.6, 8), SERVO_KAPAK, 7.5, 7.8)))

    # 7) TURKUAZ ALÇAK ŞASİ — çok alçak, turkuaz plastik gövde, hızlı; kapaklı kepçe (v01)
    C = "#14b8a6"
    parts = [k("Turkuaz alçak gövde", -10, 8, -8, 8, 1.6, 4.6, C), k("Turkuaz üst kapak", -9, 7, -7, 7, 4.6, 5.0, "#0d9488", F, malzeme="parlak"),
             k("Yan çamurluk", -10, 8, 8, 10.5, 4.6, 5.0, C, F), k("Yan çamurluk", -10, 8, -10.5, -8, 4.6, 5.0, C, F)]
    parts += kepce_ve_kapak(8, "#115e59") + ultrason_gorsel(8.1, 6.0) + [k("Ultrason ayağı", 7.4, 7.8, -0.5, 0.5, 5.0, 5.2, "#115e59", F)] + ortak_ust(-1.5, 0, 5.0)
    P.append(profil("turkuaz_alcak", "Turkuaz alçak şasi (video)", C,
        "Videodaki çok alçak turkuaz gövdeli hızlı robot: 4 koyu teker, çamurluklar, önde kapaklı kepçe. JGA25 motorlar, 3S pil. Temsili.",
        kod("strateji.ino"),
        {"kutle_kg": 1.0, "agirlik_merkezi": {"x_cm": -1, "z_cm": 3}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 6, "genislik_cm": 2.4, "iz_cm": 18.5, "x_cm": -1.5, "adet": 4, "dingil_cm": 12, "lastik_renk": "#1f2937"},
         "sarhos_teker": N, "motor": {"model": "JGA25-370 12V 280"}, "pil": {"volt": 11.1}, "acil_stop": {"x": -7, "y": 4.5, "z": 5}, "parcalar": parts},
        devre([US(8.5, 6.0), ZEM(2)] + kepce_sensorleri(8, 8.4), SERVO_KAPAK, -8, 5.1)))

    # 8) KIRMIZI UZUN KIZAK — iki teker + sarhoş, önü uzun alçak süpürge plakası (v16)
    K = "#dc2626"
    parts = [k("Kırmızı gövde", -10, 4, -7.5, 7.5, 2.4, 6, K), k("Uzun süpürge plakası", 4, 15, -10, 10, 0.25, 0.6, "#991b1b"),
             egik("Sol süpürge kenarı", 4.6, 7.6, 15, 10, 0.5, 0.6, 2.8, "#991b1b"), egik("Sağ süpürge kenarı", 4.6, -7.6, 15, -10, 0.5, 0.6, 2.8, "#991b1b"),
             k("Süpürge arka", 4.0, 4.5, -7.5, 7.5, 0.6, 2.8, "#991b1b"), k("Mavi LED şeridi", 3.9, 4.2, -6, 6, 5, 5.6, "#3b82f6", F, malzeme="led")]
    parts += ultrason_gorsel(4.2, 4.5) + ortak_ust(-4, 0, 6)
    P.append(profil("kirmizi_kizak", "Kırmızı uzun kızak (video)", K,
        "Videodaki önü uzun, alçak süpürge plakalı kırmızı robot: iki teker + sarhoş teker, yumurtaları plakanın önünde sürükler, renk ayırmaz. Temsili.",
        kod("buldozer.ino").replace("#define KAVIS 18", "#define KAVIS 10"),
        {"kutle_kg": 1.2, "agirlik_merkezi": {"x_cm": -6, "z_cm": 4}, "tekerlek": {"lastik": "kaucuk", "cap_cm": 6.5, "genislik_cm": 2.6, "iz_cm": 18, "x_cm": -4, "jant_renk": "#f3f4f6"},
         "sarhos_teker": {"x_cm": -11, "y_cm": 0, "cap_cm": 1.6}, "motor": {"model": "TT 1:48 6V"}, "pil": {"volt": 7.4}, "acil_stop": {"x": -9.5, "y": 4.5, "z": 6}, "parcalar": parts},
        devre([US(4.5, 4.5), ZEM(0)], [], -6, 6.1)))
    return P
