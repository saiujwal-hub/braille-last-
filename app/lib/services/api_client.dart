/// HTTP client for the Braille Bridge server.
library;

import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/scan_result.dart';

class ApiClient {
  final String host;

  ApiClient(this.host);

  Uri _uri(String path) => Uri.parse('$host$path');

  /// POST a photo to /scan. Returns the decoded ScanResult.
  Future<ScanResult> scan(Uint8List jpegBytes, {bool debug = false}) async {
    final request = http.MultipartRequest(
      'POST',
      _uri('/scan${debug ? '?debug=true' : ''}'),
    );
    request.files.add(
      http.MultipartFile.fromBytes('file', jpegBytes, filename: 'photo.jpg', contentType: 'application/octet-stream'),
    );
    final streamed = await request.send().timeout(const Duration(seconds: 45));
    final response = await http.Response.fromStream(streamed);
    return _decode<ScanResult>(response, ScanResult.fromJson);
  }

  Future<bool> health() async {
    try {
      final resp = await http.get(_uri('/health')).timeout(const Duration(seconds: 5));
      return resp.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Request TTS audio; falls back to on-device TTS when the server has no engine.
  Future<Uint8List?> ttsWav(String text) async {
    final resp = await http
        .post(
          _uri('/tts'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'text': text}),
        )
        .timeout(const Duration(seconds: 30));
    if (resp.statusCode != 200) return null;
    final body = jsonDecode(resp.body) as Map<String, dynamic>;
    final b64 = body['audio_base64'] as String?;
    if (b64 == null) return null;
    return base64Decode(b64);
  }

  /// Static connectivity check used by the Settings screen.
  static Future<bool> ping(String host) async {
    try {
      final resp =
          await http.get(Uri.parse('$host/health')).timeout(const Duration(seconds: 5));
      return resp.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  T _decode<T>(http.Response response, T Function(Map<String, dynamic>) fromJson) {
    final decoded = jsonDecode(response.body);
    if (response.statusCode != 200) {
      throw ApiError.fromJson((decoded as Map<String, dynamic>));
    }
    return fromJson(decoded as Map<String, dynamic>);
  }
}
