/// Speech output: server-side WAV (offline Coqui VITS) first, on-device engine as
/// a fallback when the server is unreachable or has no TTS engine.
library;

import 'dart:io';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_tts/flutter_tts.dart';

import 'api_client.dart';

class TtsService {
  final FlutterTts _tts = FlutterTts();
  final AudioPlayer _player = AudioPlayer();

  Future<void> speak(String text, {String? serverHost}) async {
    if (serverHost != null) {
      try {
        final wav = await ApiClient(serverHost).ttsWav(text);
        if (wav != null && wav.isNotEmpty) {
          await _playWav(wav);
          return;
        }
      } catch (_) {
        // fall through to the on-device engine
      }
    }
    await _tts.setLanguage('en-US');
    await _tts.speak(text);
  }

  Future<void> _playWav(Uint8List wav) async {
    final file = File(
      '${Directory.systemTemp.path}/braille_bridge_${DateTime.now().millisecondsSinceEpoch}.wav',
    );
    await file.writeAsBytes(wav);
    await _player.stop();
    await _player.play(DeviceFileSource(file.path));
  }

  Future<void> stop() async {
    await _player.stop();
    await _tts.stop();
  }
}
