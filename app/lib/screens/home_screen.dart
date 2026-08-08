import 'package:camera/camera.dart';
import 'package:flutter/material.dart';

import '../config.dart';
import '../services/api_client.dart';
import 'result_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  CameraController? _controller;
  bool _ready = false;
  bool _capturing = false;
  String _serverHost = AppConfig.defaultHost;
  bool _debugMode = false;

  @override
  void initState() {
    super.initState();
    _initCamera();
    _loadServerHost();
  }

  Future<void> _loadServerHost() async {
    final host = await AppConfig.serverHost;
    if (mounted) setState(() => _serverHost = host);
  }

  Future<void> _initCamera() async {
    try {
      final cameras = await availableCameras();
      if (cameras.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('No camera available on this device.')),
          );
        }
        return;
      }
      final back = cameras.firstWhere(
        (c) => c.lensDirection == CameraLensDirection.back,
        orElse: () => cameras.first,
      );
      final controller = CameraController(back, ResolutionPreset.high, enableAudio: false);
      await controller.initialize();
      if (!mounted) return;
      setState(() {
        _controller = controller;
        _ready = true;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Camera init failed: $e')),
        );
      }
    }
  }

  Future<void> _capture() async {
    if (_controller == null || !_ready || _capturing) return;
    setState(() => _capturing = true);
    try {
      final shot = await _controller!.takePicture();
      final bytes = await shot.readAsBytes();
      if (!mounted) return;

      final api = ApiClient(_serverHost);
      final result = await api.scan(bytes, debug: _debugMode);
      if (!mounted) return;
      Navigator.of(context).push(
        MaterialPageRoute(
          builder: (_) => ResultScreen(
            result: result,
            serverHost: _serverHost,
          ),
        ),
      );
    } catch (e) {
      if (mounted) {
        final msg = e is ApiError
            ? 'Server says: ${e.message}'
            : 'Could not reach server at $_serverHost.\n\n$e';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      }
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  Future<void> _openSettings() async {
    final updated = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const SettingsScreen()),
    );
    if (updated != null && mounted) {
      setState(() => _serverHost = updated);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Braille Bridge'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            tooltip: 'Server settings',
            onPressed: _openSettings,
          ),
        ],
      ),
      body: _ready
          ? Column(
              children: [
                Expanded(child: CameraPreview(_controller!)),
                _buildControls(context),
              ],
            )
          : const Center(child: CircularProgressIndicator()),
    );
  }

  Widget _buildControls(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('Server: $_serverHost',
              style: Theme.of(context).textTheme.bodySmall),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: _capturing ? null : _capture,
                  icon: _capturing
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.camera_alt),
                  label: const Text('Read Braille'),
                ),
              ),
              const SizedBox(width: 12),
              FilterChip(
                label: const Text('Debug'),
                selected: _debugMode,
                onSelected: (v) => setState(() => _debugMode = v),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
