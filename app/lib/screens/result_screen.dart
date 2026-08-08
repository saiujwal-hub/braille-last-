import 'package:flutter/material.dart';

import '../services/tts_service.dart';
import '../models/scan_result.dart';
import 'debug_screen.dart';

class ResultScreen extends StatefulWidget {
  final ScanResult result;
  final String serverHost;

  const ResultScreen({super.key, required this.result, required this.serverHost});

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  bool _speaking = false;

  @override
  Widget build(BuildContext context) {
    final result = widget.result;
    final text = result.text.isEmpty ? 'No text found.' : result.text;
    final uncertainCount = result.uncertainIndices.length;

    return Scaffold(
      appBar: AppBar(title: const Text('Result')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _textCard(context, text, uncertainCount),
          const SizedBox(height: 12),
          _metaRow(result),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  icon: const Icon(Icons.volume_up),
                  label: Text(_speaking ? 'Stop' : 'Speak'),
                  onPressed: () => _toggleSpeak(text),
                ),
              ),
              if (result.debug != null) ...[
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.bug_report),
                    label: const Text('Debug'),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => DebugScreen(payload: result.debug!),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _textCard(BuildContext context, String text, int uncertainCount) {
    final ts = Theme.of(context).textTheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Decoded text', style: ts.titleSmall),
            const SizedBox(height: 8),
            SelectableText(
              text,
              style: ts.headlineSmall!.copyWith(
                height: 1.5,
                letterSpacing: 1.5,
              ),
            ),
            if (uncertainCount > 0) ...[
              const SizedBox(height: 8),
              Text(
                '$uncertainCount character(s) read with low confidence (shown in amber).',
                style: ts.bodySmall!.copyWith(color: Colors.amber.shade800),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _metaRow(ScanResult result) {
    final q = result.quality;
    return Wrap(
      spacing: 12,
      runSpacing: 8,
      children: [
        _chip(context, 'Confidence', '${(result.overallConfidence * 100).round()}%'),
        _chip(context, 'Detector', q.detector),
        _chip(context, 'Blur', q.blurry ? 'yes' : 'no'),
        _chip(context, 'Enhanced', q.enhanced ? 'yes' : 'no'),
        _chip(context, 'Lighting', q.lighting),
        _chip(context, 'Cells', '${result.cells.length}'),
      ],
    );
  }

  Widget _chip(BuildContext context, String label, String value) {
    return Chip(
      label: Text('$label: $value', style: Theme.of(context).textTheme.bodySmall),
    );
  }

  Future<void> _toggleSpeak(String text) async {
    if (_speaking) {
      await TtsService().stop();
      setState(() => _speaking = false);
      return;
    }
    setState(() => _speaking = true);
    await TtsService().speak(text, serverHost: widget.serverHost);
    if (mounted) setState(() => _speaking = false);
  }
}
