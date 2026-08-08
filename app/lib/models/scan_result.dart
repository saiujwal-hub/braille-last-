/// Models mirroring `server/app/schemas.py`.
library;

class CellResult {
  final int row;
  final int col;
  final List<int> box; // [x, y, w, h]
  final int mask;
  final String unicode;
  final String character;
  final double confidence;
  final bool uncertain;

  CellResult({
    required this.row,
    required this.col,
    required this.box,
    required this.mask,
    required this.unicode,
    required this.character,
    required this.confidence,
    required this.uncertain,
  });

  factory CellResult.fromJson(Map<String, dynamic> json) => CellResult(
        row: json['row'] as int,
        col: json['col'] as int,
        box: (json['box'] as List<dynamic>).cast<int>(),
        mask: json['mask'] as int,
        unicode: json['unicode'] as String,
        character: json['character'] as String,
        confidence: (json['confidence'] as num).toDouble(),
        uncertain: json['uncertain'] as bool,
      );
}

class DebugPayload {
  final String? original;
  final String? preprocessed;
  final String? cellsOverlay;
  final String? dotsOverlay;
  final List<CellResult> cells;
  final List<List<int>> dotPoints;

  DebugPayload({
    this.original,
    this.preprocessed,
    this.cellsOverlay,
    this.dotsOverlay,
    required this.cells,
    required this.dotPoints,
  });

  factory DebugPayload.fromJson(Map<String, dynamic> json) {
    final dots = (json['dots'] as Map<String, dynamic>? ?? const {})['points'] as List<dynamic>? ?? [];
    return DebugPayload(
      original: json['original'] as String?,
      preprocessed: json['preprocessed'] as String?,
      cellsOverlay: json['cells_overlay'] as String?,
      dotsOverlay: json['dots_overlay'] as String?,
      cells: ((json['cells'] as List<dynamic>?) ?? [])
          .map((e) => CellResult.fromJson(e as Map<String, dynamic>))
          .toList(),
      dotPoints: dots.map((e) => (e as List<dynamic>).cast<int>()).toList(),
    );
  }
}

class QualityReport {
  final bool blurry;
  final bool enhanced;
  final bool perspectiveCorrected;
  final String lighting;
  final bool claheApplied;
  final String detector;

  QualityReport({
    required this.blurry,
    required this.enhanced,
    required this.perspectiveCorrected,
    required this.lighting,
    required this.claheApplied,
    required this.detector,
  });

  factory QualityReport.fromJson(Map<String, dynamic> json) => QualityReport(
        blurry: json['blurry'] as bool,
        enhanced: json['enhanced'] as bool,
        perspectiveCorrected: json['perspective_corrected'] as bool,
        lighting: json['lighting'] as String,
        claheApplied: json['clahe_applied'] as bool,
        detector: json['detector'] as String,
      );
}

class ScanResult {
  final String text;
  final String language;
  final double overallConfidence;
  final List<List<int>> uncertainIndices;
  final List<CellResult> cells;
  final QualityReport quality;
  final DebugPayload? debug;

  ScanResult({
    required this.text,
    required this.language,
    required this.overallConfidence,
    required this.uncertainIndices,
    required this.cells,
    required this.quality,
    this.debug,
  });

  factory ScanResult.fromJson(Map<String, dynamic> json) => ScanResult(
        text: json['text'] as String,
        language: json['language'] as String,
        overallConfidence: (json['overall_confidence'] as num).toDouble(),
        uncertainIndices: ((json['uncertain_indices'] as List<dynamic>?) ?? [])
            .map((e) => (e as List<dynamic>).cast<int>())
            .toList(),
        cells: ((json['cells'] as List<dynamic>?) ?? [])
            .map((e) => CellResult.fromJson(e as Map<String, dynamic>))
            .toList(),
        quality: QualityReport.fromJson(json['quality'] as Map<String, dynamic>),
        debug: json['debug'] == null
            ? null
            : DebugPayload.fromJson(json['debug'] as Map<String, dynamic>),
      );
}

class TtsResult {
  final String audioBase64;
  TtsResult(this.audioBase64);
}
