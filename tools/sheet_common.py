"""Bagian yang dipakai bareng oleh pemotong sprite sheet.

Dipisah supaya pemotong grid (`slice_grid_sheet.py`) dan pemotong sheet yang
frame-nya tidak rata (`slice_packed_sheet.py`) tidak menyalin kode yang sama.
"""

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS_DIR = ROOT / "assets"
OUTPUT_DIR = ASSETS_DIR / "frames"

# Dipakai untuk mencari ukuran kanvas + tinggi karakter acuan
REFERENCE_FOLDERS = ["idle-blink", "walk-right", "greeting", "celebrate"]

ALPHA_THRESHOLD = 10

# Jarak dari dasar kanvas ke garis lantai. Sama dengan PADDING di slice_sprite.py
FLOOR_PADDING = 8

# Buangan: gumpalan yang seluruhnya berada di luar rentang badan — di atas,
# di bawah, di kiri, atau di kanannya — dan jauh lebih kecil darinya dianggap
# sisa sel tetangganya, bukan bagian gambar.
STRAY_MAX_AREA_RATIO = 0.25

# Bercak sekecil ini tidak akan terlihat lagi setelah diperkecil
MIN_BLOB_AREA = 60


def alpha_mask(image):
    return np.array(image)[:, :, 3] > ALPHA_THRESHOLD


def label_blobs(mask):
    """Labeli gumpalan yang saling menempel (4-arah) lewat union-find."""
    height, width = mask.shape

    parent = {}

    def find(node):
        root = node

        while parent[root] != root:
            root = parent[root]

        while parent[node] != root:
            parent[node], node = root, parent[node]

        return root

    def union(left, right):
        root_left, root_right = find(left), find(right)

        if root_left != root_right:
            parent[root_right] = root_left

    labels = np.zeros((height, width), dtype=np.int32)
    next_label = 0

    for y in range(height):
        for x in np.nonzero(mask[y])[0]:
            above = labels[y - 1, x] if y else 0
            before = labels[y, x - 1] if x else 0

            if above and before:
                labels[y, x] = above
                union(above, before)
            elif above or before:
                labels[y, x] = above or before
            else:
                next_label += 1
                parent[next_label] = next_label
                labels[y, x] = next_label

    if not next_label:
        return labels, []

    remap = np.zeros(next_label + 1, dtype=np.int32)

    for label in parent:
        remap[label] = find(label)

    labels = remap[labels]

    return labels, sorted(set(remap[1:].tolist()))


def erase(cell, drop):
    if not drop.any():
        return cell

    pixels = np.array(cell)
    pixels[drop] = (0, 0, 0, 0)

    return Image.fromarray(pixels, "RGBA")


def clean_cell(cell):
    """Buang gumpalan melayang di sekeliling badan, beserta bercaknya.

    Gumpalan seperti itu datangnya dari sel tetangga: sisa yang ikut terbawa
    waktu sheet dibuat, atau ujung gambar sebelahnya yang masuk ke dalam
    potongan. Tetangganya bisa di baris atas-bawah maupun di kolom kiri-kanan,
    jadi keterpisahannya diperiksa pada kedua sumbu.

    Tanda seperti "?" atau percikan tetap aman: gambarnya masih bersinggungan
    dengan rentang badan di kedua sumbu, jadi tidak terhitung terpisah.

    Dikerjakan sebelum penskalaan supaya kotak isi (dan garis lantai baris)
    dihitung dari gambar yang sudah bersih.
    """
    mask = alpha_mask(cell)

    if not mask.any():
        return cell

    labels, blob_ids = label_blobs(mask)

    rows_of = {
        blob: np.nonzero((labels == blob).any(axis=1))[0]
        for blob in blob_ids
    }

    columns_of = {
        blob: np.nonzero((labels == blob).any(axis=0))[0]
        for blob in blob_ids
    }

    areas = {blob: int((labels == blob).sum()) for blob in blob_ids}

    body = max(blob_ids, key=lambda blob: areas[blob])
    body_top = int(rows_of[body][0])
    body_bottom = int(rows_of[body][-1])
    body_left = int(columns_of[body][0])
    body_right = int(columns_of[body][-1])

    drop = np.zeros_like(mask)

    for blob in blob_ids:
        if blob == body:
            continue

        detached = (
            int(rows_of[blob][-1]) < body_top
            or int(rows_of[blob][0]) > body_bottom
            or int(columns_of[blob][-1]) < body_left
            or int(columns_of[blob][0]) > body_right
        )

        if areas[blob] < MIN_BLOB_AREA or (
            detached and areas[blob] <= areas[body] * STRAY_MAX_AREA_RATIO
        ):
            drop |= labels == blob

    return erase(cell, drop)


def content_box(mask):
    rows = np.nonzero(mask.any(axis=1))[0]
    columns = np.nonzero(mask.any(axis=0))[0]

    if not len(rows) or not len(columns):
        return None

    return (
        int(columns[0]),
        int(rows[0]),
        int(columns[-1]) + 1,
        int(rows[-1]) + 1,
    )


def read_reference():
    """Ukuran kanvas dan tinggi karakter dari frame yang sudah ada."""
    sizes = set()
    heights = []

    for folder in REFERENCE_FOLDERS:
        for frame_file in sorted((OUTPUT_DIR / folder).glob("*.png")):
            frame = Image.open(frame_file).convert("RGBA")
            box = content_box(alpha_mask(frame))

            sizes.add(frame.size)

            if box:
                heights.append(box[3] - box[1])

    if len(sizes) != 1:
        raise SystemExit(f"Frame lama ukurannya tidak seragam: {sizes}")

    if not heights:
        raise SystemExit("Tidak ada frame acuan yang bisa diukur")

    return sizes.pop(), float(np.median(heights))


def clear_folder(folder):
    folder.mkdir(parents=True, exist_ok=True)

    for old_frame in folder.glob("*.png"):
        old_frame.unlink()
