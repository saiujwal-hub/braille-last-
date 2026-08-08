import 'dart:convert';

import 'package:flutter/material.dart';

import '../models/scan_result.dart';

class DebugScreen extends StatelessWidget {
  final DebugPayload payload;

  const DebugScreen({super.key, required this.payload});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pipeline debug')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _imageCard(context, 'Original', payload.original),
          _imageCard(context, 'Preprocessed', payload.preprocessed),
          _imageCard(context, 'Cells', payload.cellsOverlay),
          _imageCard(context, 'Dots', payload.dotsOverlay),
          const SizedBox(height: 12),
          Text('Detected cells (${payload.cells.length})',
              style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: 8),
          CellsGrid(cells: payload.cells),
          const SizedBox(height: 12),
          Text('Detected dot points (${payload.dotPoints.length})',
              style: Theme.of(context).textTheme.titleSmall),
        ],
      ),
    );
  }

  Widget _imageCard(BuildContext context, String title, String? b64) {
    if (b64 == null || b64.isEmpty) return const SizedBox.shrink();
    final bytes = base64Decode(b64);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 4),
            Image.memory(
              bytes,
              fit: BoxFit.contain,
              errorBuilder: (_, __, ___) => const Text('(image unavailable)'),
            ),
          ],
        ),
      ),
    );
  }
}

class CellsGrid extends StatelessWidget {
  final List<CellResult> cells;

  const CellsGrid({super.key, required this.cells});

  @override
  Widget build(BuildContext context) {
    if (cells.isEmpty) {
      return const Text('No cells decoded.');
    }
    final maxRow = cells.fold<int>(0, (m, c) => c.row > m ? c.row : m) + 1;
    final maxCol = cells.fold<int>(0, (m, c) => c.col > m ? c.col : m) + 1;
    final grid = List<List<CellResult?>>.generate(
      maxRow,
      (_) => List<CellResult?>.filled(maxCol, null),
    );
    for (final c in cells) {
      if (c.row < maxRow && c.col < maxCol) grid[c.row][c.col] = c;
    }

    return Table(
      border: TableBorder.all(color: Colors.black12),
      defaultVerticalAlignment: TableCellVerticalAlignment.middle,
      children: [
        for (final row in grid)
          TableRow(
            children: [
              for (final cell in row)
                cell == null
                    ? const SizedBox(height: 40)
                    : Container(
                        height: 40,
                        alignment: Alignment.center,
                        color: cell.uncertain ? Colors.amber.shade200 : null,
                        child: Text(
                          cell.character == ' '
                              ? '␣'
                              : cell.character == '?'
                                  ? '?'
                                  : cell.character,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: cell.uncertain ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ),
            ],
          ),
      ],
    );
  }
}
