// Basic smoke test: the app boots and shows the login screen when no session
// is stored. Real role-feature tests come later.

import 'package:flutter_test/flutter_test.dart';

import 'package:aridai_pos_app/main.dart';

void main() {
  testWidgets('App boots to login screen', (WidgetTester tester) async {
    await tester.pumpWidget(const AridaiPosApp());
    await tester.pumpAndSettle();

    // Brand title and the login CTA should be present.
    expect(find.text('AridaiPOS'), findsOneWidget);
    expect(find.text('ВОЙТИ'), findsOneWidget);
  });
}
