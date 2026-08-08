import 'package:flutter/material.dart';

import 'screens/home_screen.dart';

void main() {
  runApp(const BrailleBridgeApp());
}

class BrailleBridgeApp extends StatelessWidget {
  const BrailleBridgeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Braille Bridge',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF1B5E8A)),
        useMaterial3: true,
      ),
      home: const HomeScreen(),
    );
  }
}
