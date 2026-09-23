"""Potong sprite sheet jadi frame-frame PNG berukuran seragam.

Versi lama memotong tiap frame pas di kotak isinya, jadi setiap PNG punya
ukuran berbeda. Waktu ditampilkan lewat `object-fit: contain` di kotak 160px,
tiap frame diskalakan beda-beda sehingga pet terlihat goyang dan ganti ukuran
saat pindah animasi.

Versi ini:
- mendeteksi baris dan frame lewat proyeksi alpha (bukan connected component),
  supaya bagian yang terpisah (percikan, tangan, plushie) tetap ikut satu frame
- memisah baris/frame yang saling menempel di lembah proyeksinya
- menempel semua frame ke kanvas berukuran sama, rata bawah pada garis lantai
  barisnya, sehingga animasi tidak bergetar
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
INPUT_FILE = ROOT / "assets" / "jinshi.png"
OUTPUT_DIR = ROOT / "assets" / "frames"

# Urutan baris di sprite sheet, dari atas ke bawah
ROW_NAMES = [
    "idle-blink",
    "walk-right",
    "run-right",
    "sleep",
    "greeting",
    "celebrate",
    "look-around",
    "cute-gesture",
    "hug-plushie",
    "directions-1",
    "directions-2",
]

ALPHA_THRESHOLD = 10

# Kolom/baris dianggap kosong kalau tintanya di bawah ini. Bukan nol supaya
# sisa antialias 1-2 piksel tidak dihitung sebagai frame baru.
ROW_INK_FLOOR = 8
COLUMN_INK_FLOOR = 4

# Celah sekecil ini dianggap masih satu frame. Antar baris celahnya bisa cuma
# 1 piksel, jadi baris tidak boleh digabung sama sekali.
ROW_MIN_GAP = 0
COLUMN_MIN_GAP = 6

# Buangan: potongan yang terlalu kecil untuk jadi frame utuh
MIN_FRAME_WIDTH = 40
MIN_FRAME_INK = 1500

# Baris/frame dipecah kalau ukurannya melebihi kelipatan ini dari yang normal
SPLIT_RATIO = 1.5

PADDING = 8


def find_bands(profile, ink_floor, min_gap):
    """Cari rentang [start, end) yang berisi tinta pada satu proyeksi."""
    bands = []
    start = None

    for index, value in enumerate(profile):
        if value > ink_floor:
            if start is None:
                start = index
        elif start is not None:
            bands.append([start, index])
            start = None

    if start is not None:
        bands.append([start, len(profile)])

    if not bands:
        return []

    # Gabungkan yang celahnya terlalu sempit untuk jadi pemisah
    merged = [bands[0]]

    for start, end in bands[1:]:
        if start - merged[-1][1] <= min_gap:
            merged[-1][1] = end
        else:
            merged.append([start, end])

    return [tuple(band) for band in merged]


def split_wide_band(profile, band, unit):
    """Pecah satu band yang menampung beberapa frame berdempetan."""
    start, end = band
    pieces = int(round((end - start) / unit))

    if pieces < 2:
        return [band]

    inner = profile[start:end]
    cuts = []

    # Cari lembah terdalam di sekitar tiap batas frame perkiraan
    for piece in range(1, pieces):
        guess = int(round(piece * (end - start) / pieces))
        window = range(
            max(1, guess - unit // 3),
            min(len(inner) - 1, guess + unit // 3),
        )

        if not window:
            continue

        cuts.append(min(window, key=lambda index: inner[index]))

    boundaries = [0, *sorted(set(cuts)), end - start]

    return [
        (start + boundaries[index], start + boundaries[index + 1])
        for index in range(len(boundaries) - 1)
    ]


def normalize_bands(profile, bands):
    """Pecah band yang jauh lebih lebar dari band lainnya di proyeksi sama."""
    sizes = [end - start for start, end in bands]
    unit = int(np.median(sizes))

    result = []

    for band in bands:
        if (band[1] - band[0]) > unit * SPLIT_RATIO:
            result.extend(split_wide_band(profile, band, unit))
        else:
            result.append(band)

    return result


def find_row_bands(mask):
    profile = mask.sum(axis=1)
    bands = find_bands(profile, ROW_INK_FLOOR, ROW_MIN_GAP)

    return normalize_bands(profile, bands)


def find_frame_boxes(mask, top, bottom):
    """Kotak isi tiap frame pada satu baris, sudah diurutkan dari kiri."""
    row_mask = mask[top:bottom, :]
    profile = row_mask.sum(axis=0)

    bands = find_bands(profile, COLUMN_INK_FLOOR, COLUMN_MIN_GAP)

    bands = [
        band
        for band in bands
        if (band[1] - band[0]) >= MIN_FRAME_WIDTH
        and profile[band[0]:band[1]].sum() >= MIN_FRAME_INK
    ]

    if not bands:
        return []

    bands = normalize_bands(profile, bands)

    boxes = []

    for left, right in bands:
        rows_with_ink = np.nonzero(row_mask[:, left:right].any(axis=1))[0]

        if not len(rows_with_ink):
            continue

        boxes.append({
            "left": left,
            "right": right,
            "top": top + int(rows_with_ink[0]),
            "bottom": top + int(rows_with_ink[-1]) + 1,
        })

    return boxes


def main():
    image = Image.open(INPUT_FILE).convert("RGBA")
    mask = np.array(image)[:, :, 3] > ALPHA_THRESHOLD

    row_bands = find_row_bands(mask)

    if len(row_bands) != len(ROW_NAMES):
        raise SystemExit(
            f"Terdeteksi {len(row_bands)} baris, "
            f"tapi ROW_NAMES berisi {len(ROW_NAMES)}: {row_bands}"
        )

    rows = []

    for name, (top, bottom) in zip(ROW_NAMES, row_bands):
        boxes = find_frame_boxes(mask, top, bottom)

        if not boxes:
            raise SystemExit(f"Baris {name} tidak menghasilkan frame")

        rows.append({"name": name, "bottom": bottom, "boxes": boxes})

    # Satu ukuran kanvas untuk semua animasi supaya pet tidak berubah skala
    # waktu ganti animasi.
    canvas_width = max(
        box["right"] - box["left"]
        for row in rows
        for box in row["boxes"]
    ) + PADDING * 2

    canvas_height = max(
        row["bottom"] - box["top"]
        for row in rows
        for box in row["boxes"]
    ) + PADDING * 2

    print(f"Kanvas frame: {canvas_width}x{canvas_height}\n")

    for row in rows:
        output_folder = OUTPUT_DIR / row["name"]
        output_folder.mkdir(parents=True, exist_ok=True)

        for old_frame in output_folder.glob("*.png"):
            old_frame.unlink()

        for index, box in enumerate(row["boxes"], start=1):
            cropped = image.crop((
                box["left"],
                box["top"],
                box["right"],
                row["bottom"],
            ))

            canvas = Image.new("RGBA", (canvas_width, canvas_height), (0, 0, 0, 0))

            # Rata tengah secara horizontal, dan rata lantai baris secara
            # vertikal supaya frame melayang tetap terlihat melayang.
            canvas.paste(
                cropped,
                (
                    (canvas_width - cropped.width) // 2,
                    canvas_height - PADDING - cropped.height,
                ),
            )

            canvas.save(output_folder / f"{index:02}.png")

        print(f"{row['name']}: {len(row['boxes'])} frame")


if __name__ == "__main__":
    main()
