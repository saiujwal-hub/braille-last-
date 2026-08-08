import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:braille_bridge/models/scan_result.dart';
import 'package:braille_bridge/screens/debug_screen.dart';

CellResult _cell(int row, int col, String ch, {bool uncertain = false}) => CellResult(
      row: row,
      col: col,
      box: [0, 0, 40, 60],
      mask: 0,
      unicode: '',
      character: ch,
      confidence: 0.9,
      uncertain: uncertain,
    );

void main() {
  testWidgets('CellsGrid renders decoded characters', (tester) async {
    final cells = [
      _cell(0, 0, 'h'),
      _cell(0, 1, 'i'),
      _cell(0, 2, ' '),
    ];
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: CellsGrid(cells: cells)),
      ),
    );
    expect(find.text('h'), findsOneWidget);
    expect(find.text('i'), findsOneWidget);
    expect(find.text('␣'), findsOneWidget);
  });

  testWidgets('Uncertain cells are rendered distinctly', (tester) async {
    final cells = [_cell(0, 0, '?', uncertain: true)];
    await tester.pumpWidget(
      MaterialApp(home: Scaffold(body: CellsGrid(cells: cells))),
    );
    expect(find.text('?'), findsOneWidget);
  });
}
