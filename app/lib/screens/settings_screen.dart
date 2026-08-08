import 'package:flutter/material.dart';

import '../config.dart';
import '../services/api_client.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _controller = TextEditingController();
  bool _checking = false;
  bool? _reachable;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final host = await AppConfig.serverHost;
    _controller.text = host;
  }

  Future<void> _save() async {
    final normalized = AppConfig.normalizeHost(_controller.text);
    await AppConfig.setServerHost(normalized);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Server saved.')),
      );
      Navigator.of(context).pop(normalized);
    }
  }

  Future<void> _check() async {
    setState(() {
      _checking = true;
      _reachable = null;
    });
    final host = AppConfig.normalizeHost(_controller.text);
    final ok = await ApiClient.ping(host);
    if (mounted) {
      setState(() {
        _checking = false;
        _reachable = ok;
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Server settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Point the app at your Braille Bridge server on the same Wi-Fi.'),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            keyboardType: TextInputType.url,
            decoration: const InputDecoration(
              labelText: 'Server URL',
              hintText: 'http://192.168.1.100:8000',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              OutlinedButton.icon(
                icon: const Icon(Icons.network_check),
                label: const Text('Check connection'),
                onPressed: _checking ? null : _check,
              ),
              const SizedBox(width: 12),
              if (_reachable == true)
                const Icon(Icons.check_circle, color: Colors.green)
              else if (_reachable == false)
                const Icon(Icons.cancel, color: Colors.red),
            ],
          ),
          const SizedBox(height: 24),
          FilledButton.icon(
            icon: const Icon(Icons.save),
            label: const Text('Save'),
            onPressed: _save,
          ),
        ],
      ),
    );
  }
}
