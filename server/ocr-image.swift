import Foundation
import Vision
import ImageIO

let args = CommandLine.arguments
guard args.count >= 2 else {
  fputs("Missing image path\n", stderr)
  exit(2)
}

let imageURL = URL(fileURLWithPath: args[1])
guard let imageSource = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
      let image = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
  fputs("Cannot read image\n", stderr)
  exit(3)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]

let handler = VNImageRequestHandler(cgImage: image, options: [:])
do {
  try handler.perform([request])
  let text = (request.results ?? [])
    .compactMap { $0.topCandidates(1).first?.string }
    .joined(separator: "\n")
  print(text)
} catch {
  fputs("OCR failed: \(error.localizedDescription)\n", stderr)
  exit(4)
}
