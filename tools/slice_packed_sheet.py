"""Potong sprite sheet yang frame-nya tidak duduk di grid seragam.

`slice_grid_sheet.py` mengandalkan tiap frame berada di sel berukuran sama.
Sheet ekspresi tidak seperti itu: posisi frame melenceng makin ke kanan, tinggi
barisnya tidak persis sama, beberapa pose berbaring melebar sampai menempel
dengan frame sebelahnya, dan rambut satu baris menyentuh baris di bawahnya.
Memotongnya per sel akan memenggal rambut dan pose yang melebar.

Jadi di sini batas frame dicari dari gambarnya sendiri:

- batas antar baris diambil dari lembah proyeksi alpha, dicari di sekitar
  pembagian rata tinggi sheet
- frame dalam satu baris dipisah lewat proyeksi kolom; kalau jumlahnya masih
  kurang dari yang disebut peta, band terlebar dipecah di lembahnya
- frame dipotong persis di batas barisnya, karena rambut antar baris saling
  bersentuhan sehingga tidak bisa dipisah lewat pelabelan gumpalan

Peta JSON-nya sama seperti pemotong grid, hanya tanpa ukuran sel:

    python tools/slice_packed_sheet.py src/renderer/pet/assets/jinshi-expressive.json
"""

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from sheet_common import (
    ASSETS_DIR,
    OUTPUT_DIR,
    FLOOR_PADDING,
    alpha_mask,
    clean_cell,
    clear_folder,
    content_box,
    read_reference,
)

DEFAULT_MAPS = [ASSETS_DIR / "jinshi-expressive.json"]

# Batas antar baris digeser sejauh-jauhnya sebanyak ini dari pembagian rata
ROW_OFFSET_WINDOW = 25

# Kolom dianggap kosong kalau tintanya di bawah ini. Bukan nol supaya sisa
# antialias 1-2 piksel tidak dihitung sebagai frame baru.
COLUMN_INK_FLOOR = 2

# Celah sesempit ini masih dianggap satu frame
COLUMN_MIN_GAP = 6

# Buangan: potongan yang terlalu kecil untuk jadi frame utuh
MIN_FRAME_WIDTH = 40
MIN_FRAME_INK = 3000


def find_row_bands(mask, row_count):
    """Batas tiap baris: pembagian rata, digeser ke celah antar baris.

    Jarak antar baris di sheet ini seragam, jadi yang dicari cuma satu
    pergeseran untuk semua batas sekaligus. Mencari lembah tiap batas
    sendiri-sendiri gampang tersangkut di lembah palsu, dan satu batas yang
    meleset akan menyeret potongan baris tetangga ke dalam frame.
    """
    height = mask.shape[0]
    profile = mask.sum(axis=1)
    pitch = height / row_count

    def cut_at(offset, index):
        return min(height - 1, max(1, round(offset + index * pitch)))

    def ink_at(offset):
        return sum(
            profile[cut_at(offset, index)]
            for index in range(1, row_count)
        )

    offset = min(
        range(-ROW_OFFSET_WINDOW, ROW_OFFSET_WINDOW + 1),
        key=ink_at,
    )

    boundaries = [
        0,
        *(cut_at(offset, index) for index in range(1, row_count)),
        height,
    ]

    return list(zip(boundaries, boundaries[1:]))


def find_column_bands(profile):
    bands = []
    start = None

    for index, value in enumerate(profile):
        if value > COLUMN_INK_FLOOR:
            if start is None:
                start = index
        elif start is not None:
            bands.append([start, index])
            start = None

    if start is not None:
        bands.append([start, len(profile)])

    if not bands:
        return []

    merged = [bands[0]]

    for start, end in bands[1:]:
        if start - merged[-1][1] <= COLUMN_MIN_GAP:
            merged[-1][1] = end
        else:
            merged.append([start, end])

    return [
        tuple(band)
        for band in merged
        if (band[1] - band[0]) >= MIN_FRAME_WIDTH
        and profile[band[0]:band[1]].sum() >= MIN_FRAME_INK
    ]


def split_band(profile, band, pieces):
    """Pecah satu band jadi beberapa frame di lembah terdalamnya."""
    start, end = band
    inner = profile[start:end]
    cuts = []

    for piece in range(1, pieces):
        guess = round(piece * (end - start) / pieces)
        reach = (end - start) // (pieces * 3)

        window = range(
            max(1, guess - reach),
            min(len(inner) - 1, guess + reach),
        )

        if not window:
            continue

        cuts.append(min(window, key=lambda index: inner[index]))

    edges = [0, *sorted(set(cuts)), end - start]

    return [
        (start + edges[index], start + edges[index + 1])
        for index in range(len(edges) - 1)
    ]


def split_to_count(profile, bands, wanted):
    """Samakan jumlah band dengan jumlah frame yang disebut peta.

    Frame yang saling menempel terbaca sebagai satu band lebar, jadi band
    dibagi menurut lebarnya: makin lebar, makin banyak frame di dalamnya.
    """
    bands = sorted(bands, key=lambda band: band[0])

    # Kelebihan band berarti ada bercak yang lolos saringan; yang paling
    # sedikit tintanya dibuang.
    while len(bands) > wanted:
        lightest = min(bands, key=lambda band: profile[band[0]:band[1]].sum())

        bands.remove(lightest)

    if len(bands) == wanted:
        return bands

    widths = [end - start for start, end in bands]

    # Lebar satu frame ditaksir dari rata-rata, bukan dari band tersempit:
    # band tersempit pun bisa berisi pose yang memang lebih kurus.
    unit = sum(widths) / wanted
    pieces = [max(1, round(width / unit)) for width in widths]

    # Pembulatan bisa meleset satu-dua, jadi dirapikan lewat band yang paling
    # longgar atau paling sesak pembagiannya.
    while sum(pieces) != wanted:
        over = sum(pieces) > wanted

        candidates = [
            index
            for index in range(len(pieces))
            if not over or pieces[index] > 1
        ]

        index = (min if over else max)(
            candidates,
            key=lambda index: widths[index] / pieces[index],
        )

        pieces[index] += -1 if over else 1

    result = []

    for band, count in zip(bands, pieces):
        if count > 1:
            result.extend(split_band(profile, band, count))
        else:
            result.append(band)

    return result


def read_rows(sheet, sheet_map):
    """Frame tiap baris, sudah dibersihkan dari sisa baris tetangga."""
    mask = alpha_mask(sheet)

    row_bands = find_row_bands(mask, sheet_map["rows"])

    rows = []

    for name, spec in sheet_map["animations"].items():
        top, bottom = row_bands[spec["row"]]

        profile = mask[top:bottom].sum(axis=0)
        bands = split_to_count(
            profile,
            find_column_bands(profile),
            spec["frames"],
        )

        if len(bands) != spec["frames"]:
            raise SystemExit(
                f"{name}: peta menyebut {spec['frames']} frame, "
                f"terdeteksi {len(bands)}"
            )

        frames = []

        for left, right in bands:
            cell = clean_cell(sheet.crop((left, top, right, bottom)))

            box = content_box(alpha_mask(cell))

            if box is None:
                raise SystemExit(f"{name}: satu frame jadi kosong setelah dibersihkan")

            frames.append({"cell": cell, "box": box, "top": top})

        rows.append({
            "name": name,
            "folder": spec["folder"],
            "frames": frames,
        })

    return rows


def slice_sheet(map_file, canvas_size, reference_height):
    sheet_map = json.loads(map_file.read_text(encoding="utf-8"))

    sheet = Image.open(ASSETS_DIR / sheet_map["image"]).convert("RGBA")

    canvas_width, canvas_height = canvas_size

    rows = read_rows(sheet, sheet_map)
    scale = sheet_map["sheetScale"]

    floor_y = canvas_height - FLOOR_PADDING

    content_height = float(np.median([
        (frame["box"][3] - frame["box"][1]) * scale
        for row in rows
        for frame in row["frames"]
    ]))

    print(
        f"{map_file.name}: kanvas {canvas_width}x{canvas_height}, "
        f"skala {scale:.4f}\n"
        f"Tinggi isi {content_height:.0f}px, "
        f"frame lama {reference_height:.0f}px\n"
    )

    for row in rows:
        output_folder = OUTPUT_DIR / row["folder"]

        clear_folder(output_folder)

        # Garis lantai baris, bukan per frame, supaya pose melayang
        # (lompat, jatuh) tetap terlihat melayang.
        row_floor = max(
            frame["top"] + frame["box"][3]
            for frame in row["frames"]
        )

        widest = max(
            frame["box"][2] - frame["box"][0]
            for frame in row["frames"]
        )

        # Pose berbaring bisa lebih lebar dari kanvas. Barisnya diperkecil
        # secukupnya, karena rambut yang terpotong lebih kentara daripada
        # karakter yang sedikit lebih kecil di pose itu saja.
        row_scale = min(scale, canvas_width / widest)

        if row_scale < scale:
            print(
                f"  {row['folder']}: lebar {round(widest * scale)}px tidak "
                f"muat di kanvas {canvas_width}px, skala jadi {row_scale:.3f}"
            )

        for index, frame in enumerate(row["frames"], start=1):
            box = frame["box"]

            cropped = frame["cell"].crop(box)

            scaled = cropped.resize(
                (
                    max(1, round(cropped.width * row_scale)),
                    max(1, round(cropped.height * row_scale)),
                ),
                Image.LANCZOS,
            )

            canvas = Image.new(
                "RGBA",
                (canvas_width, canvas_height),
                (0, 0, 0, 0),
            )

            # Jarak frame ini ke garis lantai barisnya dipertahankan, supaya
            # pose yang melayang tetap terlihat melayang.
            above_floor = row_floor - (frame["top"] + box[3])

            canvas.paste(
                scaled,
                (
                    round((canvas_width - scaled.width) / 2),
                    round(floor_y - above_floor * row_scale - scaled.height),
                ),
            )

            canvas.save(output_folder / f"{index:02}.png")

        print(f"{row['folder']}: {len(row['frames'])} frame")


def main():
    map_files = (
        [Path(argument).resolve() for argument in sys.argv[1:]]
        or DEFAULT_MAPS
    )

    canvas_size, reference_height = read_reference()

    for map_file in map_files:
        slice_sheet(map_file, canvas_size, reference_height)


if __name__ == "__main__":
    main()
