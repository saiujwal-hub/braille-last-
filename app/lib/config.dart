/// Central app configuration.
///
/// The default LAN host must be edited to your server's IP, or set in the in-app
/// Settings screen. The value is persisted across launches.
library;

import 'package:shared_preferences/shared_preferences.dart';

class AppConfig {
  AppConfig._();

  static const String defaultHost = 'http://192.168.1.100:8000';

  static Future<String> get serverHost async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('server_host') ?? defaultHost;
  }

  static Future<void> setServerHost(String host) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('server_host', host);
  }

  static String normalizeHost(String host) {
    var h = host.trim();
    if (h.isEmpty) return defaultHost;
    if (!h.startsWith('http://') && !h.startsWith('https://')) {
      h = 'http://$h';
    }
    return h;
  }
}

/// Pydantic-compatible error envelope from the server.
class ApiError implements Exception {
  final String code;
  final String message;
  ApiError(this.code, this.message);

  @override
  String toString() => message;

  static ApiError fromJson(Map<String, dynamic> json) =>
      ApiError(json['error'] as String? ?? 'unknown', json['message'] as String? ?? 'Server error');
}
