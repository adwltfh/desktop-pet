// Samakan kanvas semua PNG animasi tanpa memotong atau meregangkan gambar.
// Jalankan dari root proyek: swift tools/normalize_frames.swift

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let canvasWidth = 151
let canvasHeight = 149
let framesDirectory = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    .appendingPathComponent("src/renderer/pet/assets/frames", isDirectory: true)

guard let files = FileManager.default.enumerator(
    at: framesDirectory,
    includingPropertiesForKeys: nil
) else {
    fatalError("Folder frame tidak ditemukan: \(framesDirectory.path)")
}

var changed = 0
var alreadyCorrect = 0

for case let file as URL in files where file.pathExtension.lowercased() == "png" {
    guard let source = CGImageSourceCreateWithURL(file as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fatalError("Gagal membaca \(file.path)")
    }

    if image.width == canvasWidth && image.height == canvasHeight {
        alreadyCorrect += 1
        continue
    }

    let scale = min(
        CGFloat(canvasWidth) / CGFloat(image.width),
        CGFloat(canvasHeight) / CGFloat(image.height)
    )
    let width = CGFloat(image.width) * scale
    let height = CGFloat(image.height) * scale

    guard let context = CGContext(
        data: nil,
        width: canvasWidth,
        height: canvasHeight,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        fatalError("Gagal membuat kanvas untuk \(file.path)")
    }

    context.interpolationQuality = .high
    context.draw(image, in: CGRect(
        x: (CGFloat(canvasWidth) - width) / 2,
        y: 0,
        width: width,
        height: height
    ))

    guard let result = context.makeImage() else {
        fatalError("Gagal mengolah \(file.path)")
    }

    let temporaryFile = file.deletingLastPathComponent()
        .appendingPathComponent(".\(file.lastPathComponent).normalized")

    guard let destination = CGImageDestinationCreateWithURL(
        temporaryFile as CFURL,
        UTType.png.identifier as CFString,
        1,
        nil
    ) else {
        fatalError("Gagal menulis \(temporaryFile.path)")
    }

    CGImageDestinationAddImage(destination, result, nil)

    guard CGImageDestinationFinalize(destination) else {
        fatalError("Gagal menyimpan \(temporaryFile.path)")
    }

    do {
        _ = try FileManager.default.replaceItemAt(file, withItemAt: temporaryFile)
    } catch {
        fatalError("Gagal mengganti \(file.path): \(error)")
    }

    changed += 1
    print("\(file.lastPathComponent): \(image.width)x\(image.height) → \(canvasWidth)x\(canvasHeight) [\(file.deletingLastPathComponent().lastPathComponent)]")
}

print("Selesai: \(changed) frame diseragamkan, \(alreadyCorrect) sudah sesuai.")
